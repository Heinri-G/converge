# 02 — Authentication

> **Pillar:** Authentication (6) · **Order:** 3 · **Depends on:** 00, 01
> **Goal:** Supabase Auth integrated so anyone can research immediately (guest), sign in to persist, and promote a guest session to an account — with ownership enforced by RLS.

References: PRODUCT.md (Capabilities, Operating Context), ARCHITECTURE.md (Auth pillar, RLS), AGENTS.md (Security), Supabase skill (Auth/session security).

## Decisions locked in

- **Auth: Supabase Auth** — email magic link + OAuth providers (configure the provider list in Supabase dashboard; keep the client provider list in one config object).
- **Guest mode is default.** No account needed to research; a guest session lives entirely client-side in IndexedDB (see `lib/offline.ts` below). The server sees nothing until "Save to account."
- **Signed-in = cloud source of truth.** RLS ownership (`01` template T1/T2) governs all rows.
- **Session storage:** `supabase-js` with `flowType: 'pkce'` and persistent session in `localStorage`. **Recorded trade-off:** this exposes tokens to XSS; AGENTS.md prefers HttpOnly cookies. The hardened path (cookie-based session via `@supabase/ssr`/auth Edge Function) is a recorded follow-up, not a blocker — mitigations: restrictive CSP, no `dangerouslySetInnerHTML`, escaped scraped content. Recheck against current Supabase docs at implementation time.
- Promotion is deterministic and client-driven: re-insert the session tree with an authenticated `owner_id`; the old guest copy is discarded.

## Step 1 — Supabase client auth config

Extend `src/lib/supabase.ts` (from `00`):

```ts
export const supabase = createClient(url, anonKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'converge.auth',
  },
})
```

## Step 2 — Session hook + typed data layer

`src/features/auth/hooks.ts` — `useSession()` wraps `supabase.auth.onAuthStateChange` and exposes `{ user, loading }`.

`src/lib/db.ts` — typed, RLS-guarded CRUD used everywhere (built up by later files):

```ts
export async function createSession(ownerId: string, input: SessionInput) {
  const { data, error } = await supabase
    .from('research_sessions')
    .insert({ owner_id: ownerId, ...input })
    .select()
    .single()
  if (error) throw error
  return data
}
```

## Step 3 — Guest session layer

`src/lib/offline.ts` using `idb`: store `{ guestId: crypto.randomUUID(), session: SessionDraft, candidates, analysis }` under one key. Guests create a `research_sessions`-shaped draft client-side (no server row) with `owner_id` unset.

`src/features/auth/promote.ts`:

```ts
export async function promoteGuestSession(user: User): Promise<Session | null> {
  const guest = await readGuestSession()          // from offline.ts
  if (!guest) return null
  const session = await createSession(user.id, {  // RLS: owner_id = auth.uid()
    domain_slug: guest.session.domain_slug,
    title: guest.session.title,
    resolution: guest.session.resolution,
    stage_state: guest.session.stage_state,
  })
  // 03..06 add their rows here as they land: candidates/analysis/reports
  // copy under the new session_id, then clear the guest record
  await clearGuestSession()
  return session
}
```

## Step 4 — Sign-in UI (mobile-first)

`src/features/auth/SignInScreen.tsx`:
- Email field (≥16px input) + "Send magic link" button; success state explains "Check your email."
- OAuth buttons (Google, GitHub …) from the provider config; each ≥44px tall, full-width.
- On phones the screen is a bottom-anchored card (thumb reach); on `min-width: lg` it centers.
- Guest entry: prominent "Continue without account" that starts a guest session.

Shell wiring: route guards are not used at this stage — every surface works for guests; authed state adds Save/history/share affordances.

## Step 5 — Save to account affordance

- In the app shell, when `user` exists show avatar/menu (sign out); when a guest session exists show "Save to account" → signs in, then runs `promoteGuestSession`.
- After promotion, the in-flight session continues seamlessly (swap local state for the cloud rows; TanStack Query refetch).

## Verification

1. Magic-link + OAuth sign-in and sign-out work on mobile and desktop viewports.
2. Guest: research state persists across reload (IndexedDB), and **zero rows** exist server-side (`select count(*) from research_sessions` before promotion).
3. Promote: session row appears with `owner_id` = the signed-in user; another account's RLS probe sees 0 rows (template T1 holds).
4. Sign out and back in: history from `01` remains.
5. `npm run typecheck` clean.

## Acceptance checklist

- [ ] Guest can run a full session with no account; nothing on the server until promotion
- [ ] Magic link + at least one OAuth provider work
- [ ] Promotion re-inserts the session tree under the authenticated user and clears guest data
- [ ] RLS: cross-account reads impossible; sign-out/in keeps history
- [ ] Session-storage trade-off documented; CSP present; no secrets in the bundle
- [ ] Sign-in screen verified at 390px and 1440px (44px targets, no zoom jump)

## Follow-ups

- `07` reuses promotion to also adopt reports/history at sign-in time and adds the history gate.
- Hardened cookie-based session remains an open item (ARCHITECTURE.md Open decisions).
