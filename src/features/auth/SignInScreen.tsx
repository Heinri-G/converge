import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { EmailOtpType } from '@supabase/supabase-js'
import { Eye, EyeOff } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSupabase } from '@/app/useSupabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScreenFallback } from '@/components/ui/ScreenFallback'
import { useSession } from './hooks'
import { promoteGuestSession } from './promote'

type AuthMode = 'signin' | 'signup'
type AuthView = 'password' | 'magic' | 'recovery' | 'reset'
type FormStatus = 'idle' | 'submitting' | 'sent' | 'success'

export default function SignInScreen() {
  const supabase = useSupabase()
  const { user, loading } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const intent = params.get('intent')
  const resetMode = params.get('mode') === 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [view, setView] = useState<AuthView>(resetMode ? 'reset' : 'password')
  const [status, setStatus] = useState<FormStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const promotedRef = useRef(false)
  const callbackStartedRef = useRef(false)
  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const tokenType = params.get('type') as EmailOtpType | null
  const callbackError = new URLSearchParams(window.location.hash.slice(1)).get('error_description')
  const authRedirect = `${window.location.origin}/signin${intent ? `?intent=${encodeURIComponent(intent)}` : ''}`
  const recoveryRedirect = `${window.location.origin}/signin?mode=reset`

  function clearFeedback() {
    setError(null)
    setMessage(null)
    setStatus('idle')
  }

  function switchView(nextView: AuthView) {
    clearFeedback()
    setView(nextView)
  }

  function switchAuthMode(nextMode: AuthMode) {
    clearFeedback()
    setPassword('')
    setPasswordConfirmation('')
    setAuthMode(nextMode)
  }

  function authErrorMessage(authError: { code: string | undefined; message: string }) {
    const normalized = authError.message.toLowerCase()
    if (normalized.includes('invalid login credentials')) {
      return 'Email or password is incorrect.'
    }
    if (authError.code === 'user_already_exists' || normalized.includes('already registered')) {
      return 'An account with this email may already exist. Try signing in instead.'
    }
    return authError.message
  }

  useEffect(() => {
    if (callbackStartedRef.current || (!code && !tokenHash && !callbackError)) return
    callbackStartedRef.current = true

    if (callbackError) {
      queueMicrotask(() => setError(callbackError))
      navigate(resetMode ? '/signin?mode=reset' : intent ? `/signin?intent=${encodeURIComponent(intent)}` : '/signin', {
        replace: true,
      })
      return
    }

    void (async () => {
      const callbackResult = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : tokenHash && tokenType
          ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tokenType })
          : { error: new Error('The sign-in link is missing required information') }

      if (callbackResult.error) {
        setError(callbackResult.error.message)
        navigate(resetMode ? '/signin?mode=reset' : intent ? `/signin?intent=${encodeURIComponent(intent)}` : '/signin', {
          replace: true,
        })
      } else if (resetMode) {
        setView('reset')
        navigate('/signin?mode=reset', { replace: true })
      }
    })()
  }, [callbackError, code, intent, navigate, resetMode, supabase, tokenHash, tokenType])

  useEffect(() => {
    if (!user || resetMode || view === 'reset') return
    let cancelled = false
    void (async () => {
      if (intent === 'promote' && !promotedRef.current) {
        promotedRef.current = true
        try {
          await promoteGuestSession(user)
        } catch (err) {
          console.error('Guest promotion failed', err)
        }
      }
      if (!cancelled) navigate('/', { replace: true })
    })()
    return () => {
      cancelled = true
    }
  }, [resetMode, user, intent, navigate, view])

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || !password || status === 'submitting') return
    if (authMode === 'signup' && password !== passwordConfirmation) {
      setError('Passwords do not match.')
      return
    }
    setStatus('submitting')
    setError(null)
    setMessage(null)

    const result =
      authMode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: trimmed, password })
        : await supabase.auth.signUp({
            email: trimmed,
            password,
            options: { emailRedirectTo: authRedirect },
          })

    if (result.error) {
      setError(authErrorMessage(result.error))
      setStatus('idle')
      return
    }
    if (authMode === 'signup' && !result.data.session) {
      setMessage('Check your email to confirm your account, then return here to sign in.')
      setStatus('success')
      return
    }
    setStatus('idle')
  }

  async function handleSendMagicLink(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || status === 'submitting') return
    setStatus('submitting')
    setError(null)
    setMessage(null)
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: authRedirect },
    })
    if (sendError) {
      setError(
        sendError.code === 'over_email_send_rate_limit'
          ? 'Supabase has reached its email sending limit. Wait for the hourly quota to reset or configure custom SMTP.'
          : sendError.status === 429 || sendError.message.toLowerCase().includes('rate limit')
            ? 'Please wait about a minute before requesting another sign-in link.'
            : sendError.message,
      )
      setStatus('idle')
      return
    }
    setStatus('sent')
  }

  async function handleRecovery(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || status === 'submitting') return
    setStatus('submitting')
    setError(null)
    setMessage(null)
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: recoveryRedirect,
    })
    if (recoveryError) {
      setError(recoveryError.message)
      setStatus('idle')
      return
    }
    setMessage('If an account exists for this email, we sent a password reset link.')
    setStatus('success')
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault()
    if (!password || password !== passwordConfirmation || status === 'submitting') {
      if (password !== passwordConfirmation) setError('Passwords do not match.')
      return
    }
    setStatus('submitting')
    setError(null)
    const { error: resetError } = await supabase.auth.updateUser({ password })
    if (resetError) {
      setError(resetError.message)
      setStatus('idle')
      return
    }
    setMessage('Your password has been updated.')
    setStatus('success')
  }

  if (loading) return <ScreenFallback />

  function renderError() {
    return error ? (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    ) : null
  }

  function renderPasswordField(label: string, value: string, onChange: (value: string) => void, id: string) {
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <div className="relative">
          <Input
            id={id}
            type={showPassword ? 'text' : 'password'}
            autoComplete={id === 'signin-password' ? 'current-password' : 'new-password'}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-11 pr-12 text-base md:text-base"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            aria-label={showPassword ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
    )
  }

  return (
    <section className="flex min-h-full flex-col">
      <div className="flex flex-1 items-end justify-center lg:items-center">
        <Card className="w-full max-w-md rounded-t-2xl rounded-b-none border-b-0 p-6 lg:rounded-2xl lg:border-b">
          <p className="font-mono text-[11px] font-medium tracking-[0.22em] text-gold-text uppercase">
            Account
          </p>
          <h1 className="mt-2.5 text-2xl leading-tight font-semibold tracking-tight">
            {view === 'recovery'
              ? 'Reset your password.'
              : view === 'reset'
                ? 'Choose a new password.'
                : 'Keep your research in reach.'}
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            {view === 'recovery'
              ? 'We will send a reset link if an account matches your email.'
              : view === 'reset'
                ? 'Use a password you will remember for your next visit.'
                : 'Sign in to save sessions across devices. Guest research stays on this device.'}
          </p>

          {view === 'password' && (
            <>
              <div className="mt-6 grid grid-cols-2 border-b border-border pb-2" role="tablist" aria-label="Account access">
                {(['signin', 'signup'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={authMode === mode}
                    className={`min-h-11 border-b-2 px-2 text-sm font-medium transition-colors ${
                      authMode === mode
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => switchAuthMode(mode)}
                  >
                    {mode === 'signin' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>
              {status === 'success' ? (
                <div className="mt-6 flex flex-col gap-3" role="status">
                  <p className="text-sm">{message}</p>
                  <Button type="button" variant="outline" size="lg" className="h-11" onClick={() => switchAuthMode('signin')}>
                    Return to sign in
                  </Button>
                </div>
              ) : (
                <form className="mt-6 flex flex-col gap-4" onSubmit={handlePasswordSubmit} noValidate>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="signin-email" className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="signin-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-11 text-base md:text-base"
                    />
                  </div>
                  {renderPasswordField('Password', password, setPassword, 'signin-password')}
                  {authMode === 'signup' &&
                    renderPasswordField('Confirm password', passwordConfirmation, setPasswordConfirmation, 'confirm-password')}
                  {authMode === 'signin' && (
                    <button
                      type="button"
                      className="min-h-11 self-start px-0 text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
                      onClick={() => switchView('recovery')}
                    >
                      Forgot password?
                    </button>
                  )}
                  {renderError()}
                  <Button type="submit" size="lg" className="h-11" disabled={!email.trim() || !password || status === 'submitting'}>
                    {status === 'submitting'
                      ? authMode === 'signin'
                        ? 'Signing in…'
                        : 'Creating account…'
                      : authMode === 'signin'
                        ? 'Sign in'
                        : 'Create account'}
                  </Button>
                </form>
              )}
              <button
                type="button"
                className="mt-4 min-h-11 self-start px-0 text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
                onClick={() => switchView('magic')}
              >
                Use a magic link instead
              </button>
            </>
          )}

          {view === 'magic' && (
            <>
              {status === 'sent' ? (
                <div className="mt-6 flex flex-col gap-3" role="status">
                  <p className="text-sm">
                    We sent a sign-in link to <span className="font-medium">{email}</span>. Open it on this device to continue.
                  </p>
                  <Button type="button" variant="outline" size="lg" className="h-11" onClick={() => clearFeedback()}>
                    Send another link
                  </Button>
                </div>
              ) : (
                <form className="mt-6 flex flex-col gap-4" onSubmit={handleSendMagicLink} noValidate>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="magic-email" className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="magic-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-11 text-base md:text-base"
                    />
                  </div>
                  {renderError()}
                  <Button type="submit" size="lg" className="h-11" disabled={!email.trim() || status === 'submitting'}>
                    {status === 'submitting' ? 'Sending…' : 'Send magic link'}
                  </Button>
                </form>
              )}
              <button
                type="button"
                className="mt-4 min-h-11 self-start px-0 text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
                onClick={() => switchView('password')}
              >
                Use email and password instead
              </button>
            </>
          )}

          {view === 'recovery' && (
            <>
              {status === 'success' ? (
                <div className="mt-6 flex flex-col gap-3" role="status">
                  <p className="text-sm">{message}</p>
                  <Button type="button" variant="outline" size="lg" className="h-11" onClick={() => switchView('password')}>
                    Return to sign in
                  </Button>
                </div>
              ) : (
                <form className="mt-6 flex flex-col gap-4" onSubmit={handleRecovery} noValidate>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="recovery-email" className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="recovery-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-11 text-base md:text-base"
                    />
                  </div>
                  {renderError()}
                  <Button type="submit" size="lg" className="h-11" disabled={!email.trim() || status === 'submitting'}>
                    {status === 'submitting' ? 'Sending…' : 'Send reset link'}
                  </Button>
                </form>
              )}
              <button
                type="button"
                className="mt-4 min-h-11 self-start px-0 text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
                onClick={() => switchView('password')}
              >
                Return to sign in
              </button>
            </>
          )}

          {view === 'reset' && (
            <>
              {status === 'success' ? (
                <div className="mt-6 flex flex-col gap-3" role="status">
                  <p className="text-sm">{message}</p>
                  <Button type="button" size="lg" className="h-11" onClick={() => navigate('/', { replace: true })}>
                    Continue to Converge
                  </Button>
                </div>
              ) : (
                <form className="mt-6 flex flex-col gap-4" onSubmit={handleReset} noValidate>
                  {renderPasswordField('New password', password, setPassword, 'new-password')}
                  {renderPasswordField('Confirm password', passwordConfirmation, setPasswordConfirmation, 'reset-confirm-password')}
                  {renderError()}
                  <Button type="submit" size="lg" className="h-11" disabled={!password || !passwordConfirmation || status === 'submitting'}>
                    {status === 'submitting' ? 'Updating password…' : 'Update password'}
                  </Button>
                </form>
              )}
            </>
          )}

          {view !== 'reset' && (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="mt-6 h-11 w-full text-muted-foreground"
              onClick={() => navigate('/', { replace: true })}
            >
              Continue without account
            </Button>
          )}
        </Card>
      </div>
    </section>
  )
}
