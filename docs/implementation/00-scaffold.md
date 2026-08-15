# 00 — Project scaffold

> **Pillar:** enabler (no pillar) · **Order:** 1 · **Depends on:** none
> **Goal:** a runnable Vite + React SPA (strict TS), installable as a PWA, with routing, server-state, the Supabase client, the mobile-first responsive foundation, and lint/typecheck. No product features yet.

References: PRODUCT.md (`## Stack`), ARCHITECTURE.md (System overview, Client architecture).

## Decisions locked in

- Vite + React SPA, TypeScript strict, React Router, TanStack Query, `vite-plugin-pwa`.
- Supabase client initialized from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` only. **Nothing else is ever a `VITE_*` var.** `.env.example` is committed with placeholders; `.env` / `.env.*` are gitignored.
- **Mobile-first responsive foundation ships here**, in the shell: mobile base styles, `min-width` breakpoints layering up to desktop, ≥44px touch targets, ≥16px inputs, safe-area insets, `100dvh`. Design work later refines the look; this file owns the structural baseline.

## Steps

### 1. package.json

Pin exact versions, commit the lockfile. Scripts:

```jsonc
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "typecheck": "tsc -b --noEmit",
    "format": "prettier --write ."
  }
}
```

Dev deps: `typescript`, `vite`, `@vitejs/plugin-react`, `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `typescript-eslint`, `prettier`, `vite-plugin-pwa`, `@playwright/test`.
Deps: `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `@supabase/supabase-js` (pinned), `idb` (IndexedDB helper for `01`+).

### 2. TypeScript — strict, no `any` leakage

`tsconfig.app.json`:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true,
    "jsx": "react-jsx",
    "types": ["vite/client"]
  }
}
```

### 3. Vite + PWA

`vite.config.ts` with `@vitejs/plugin-react` and `VitePWA`:

```ts
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
  manifest: {
    name: 'Converge',
    short_name: 'Converge',
    display: 'standalone',
    start_url: '/',
    theme_color: '#111827', // placeholder — refine during design work
    background_color: '#ffffff',
    icons: [
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
})
```

Placeholder icon PNGs at `public/pwa-192x192.png` and `public/pwa-512x512.png` (no image-conversion tools installed — ship PNG unconverted). Icons/theme get refined by the visual world later.

### 4. index.html — mobile-first viewport

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#111827" />
<meta name="description" content="Converge — research, without the rabbit hole." />
<link rel="manifest" href="/manifest.webmanifest" />
```

### 5. src skeleton

```
src/
  main.tsx          entry: mounts <App/>, registers the service worker
  app/
    App.tsx         router + providers
    providers.tsx   QueryClientProvider, SupabaseProvider
    routes.tsx      route table (stub screens per feature, lazy-loaded)
    ui/
      AppShell.tsx  bottom-nav (mobile) / side nav (desktop) shell placeholder
  lib/
    supabase.ts     Supabase client (single instance)
    types.ts        shared domain types (empty for now; grows from 01)
    query.ts        shared QueryClient
  components/
    ui/             shared presentational primitives live here from 03 on
  styles/
    tokens.css      design tokens (breakpoints, spacing, touch)
    globals.css     reset + mobile-first base
  features/         (empty — created by 02..07)
```

`src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required')

export const supabase = createClient(url, anonKey)
```

### 6. Mobile-first CSS foundation (`styles/tokens.css` + `globals.css`)

- **Tokens:** `--breakpoint-md: 640px; --breakpoint-lg: 1024px;` spacing scale (4px base), `--touch-min: 44px;`, safe-area vars `--safe-top/right/bottom/left: env(safe-area-inset-*)`, `--viewport-h: 100dvh`.
- **Base rules:** `html { -webkit-text-size-adjust: 100% }`; inputs/buttons `font-size: 16px` (prevents iOS focus zoom); all interactive elements enforce `min-height: 44px; min-width: 44px`; `body { padding: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left) }` where a fixed shell exists.
- **Breakpoint policy:** write mobile base styles first; use `@media (min-width: ...)` **only** to layer up. Never use `max-width` queries for layout. Full-height surfaces use `100dvh`, never `100vh` or `h-screen`.
- AppShell: mobile gets a bottom nav (thumb reach, 44px+ targets); at `min-width: lg` it becomes a persistent side nav.

### 7. `.env.example` and `.gitignore`

```
# .env.example
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_ANON_KEY
```

`.gitignore`: `node_modules/`, `dist/`, `.env`, `.env.*`, `!.env.example`, `*.local`.

## Verification

1. `npm install && npm run dev` boots; `npm run build`, `npm run lint`, `npm run typecheck` all pass.
2. Playwright (MCP): render at **390×844 (mobile)** and **1440×900 (desktop)**; no horizontal scroll; bottom nav reachable; shell fills the viewport without jumping on scroll (dvh).
3. PWA: DevTools → Application → manifest valid, service worker active.
4. `npm audit` clean.

## Acceptance checklist

- [ ] Dev/build/lint/typecheck pass
- [ ] PWA installable; manifest + icons present
- [ ] Supabase client connects (anon) without leaking secrets
- [ ] No horizontal overflow at 390px and 1440px
- [ ] 44px touch targets and 16px inputs in the shell
- [ ] Mobile bottom nav → desktop side nav at `lg`

## Follow-ups

- `01-data-foundation` (next): Supabase project wiring, migrations, RLS templates, first tables.
- Design tokens above are structural; the `impeccable` visual world may replace colors/typography later without touching the responsive baseline.
