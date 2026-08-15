const STORAGE_KEY = 'converge-theme'

export type ThemePreference = 'light' | 'dark'

export function getSystemTheme(): ThemePreference {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function getStoredTheme(): ThemePreference | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

export function setStoredTheme(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    /* storage unavailable — fall back to system theme */
  }
}

/** Resolve stored preference, falling back to the OS setting, and apply it. */
export function applyTheme(): void {
  const resolved = getStoredTheme() ?? getSystemTheme()
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

/** Apply the theme now and keep it in sync with OS changes when no explicit
 *  preference has been stored yet. */
export function initTheme(): void {
  applyTheme()
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (!getStoredTheme()) applyTheme()
    })
}
