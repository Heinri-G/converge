# AGENTS.md

## Project state

- **Scaffolded app shell + theme, feature flows not built.** Vite + React SPA (strict TypeScript), installable PWA, Supabase backend. The visual world is defined and the shell/stubs carry it; feature surfaces (research flow, gates, storage/sharing) are not implemented yet.
- **PRODUCT.md** at repo root is the source of product truth (created via the `impeccable` skill's `init`). Read it before building. Facts marked undecided (positioning, data sources, storage, brand/voice) must not be fabricated.
- **Stack is decided, do not re-offer:** Vite + React SPA, responsive web app installable as a PWA, backed by Supabase (Auth, Postgres + RLS, Edge Functions). **UI styling is Tailwind CSS v4 + shadcn/ui** — see `## Stack` in PRODUCT.md, the technical map in ARCHITECTURE.md, and the theme pointers below.

## Architecture reference

- **ARCHITECTURE.md** at repo root is the technical map for building features: pillar → flow mapping (stage gates, anti-rabbit-hole, scraping/sentiment, synthesis, storage/sharing, auth), client module layout, the Supabase data model + RLS rules, Edge Function conventions, and recorded open decisions. Consult it before adding features; follow the Supabase skill for any auth/RLS/schema work.
- **Implementation specs:** `docs/implementation/` contains numbered, executable build files (00 scaffold → 07 storage/sharing). Follow them **in order** when implementing a feature; each file owns its decisions, DDL/RLS, Edge Functions, client files, and acceptance checklist.

## Theme & visual world (read before UI work)

The visual world is **"Miura-Fold Sheet"** — matte paper, near-black ink, one gold
accent; mountain/valley crease semantics for strengths/risks. The ground truth for all
UI decisions:

- **`DESIGN.md`** (repo root) — the visual world doc: palette, type ramp, layout,
  elevation, shapes, component patterns, do's/don'ts, named rules. The impeccable
  `context.mjs` loads it automatically each session. `.impeccable/design.json` is its
  machine-readable sidecar (tokens, tonal ramps, motion, self-contained component
  snippets).
- **`src/styles/globals.css`** — the theme source of truth: shadcn `--color-*` tokens
  for light (`:root`) and dark (`.dark`), `@theme`/`@theme inline` Tailwind mappings
  (`bg-primary`, `text-mountain`, `border-border`, …), fonts (Geist Variable +
  Geist Mono), radii, motion eases, shadows. **Change tokens here, never duplicate
  them.**
- **`src/styles/tokens.css`** — structural (framework-agnostic) tokens: breakpoints,
  spacing, touch min, safe-area, `100dvh`, side-nav width.
- **`src/components/ui/`** — shadcn/ui primitives (button, card, input, badge,
  separator, tooltip, sheet) + `ScreenFallback`. Do not fork them; extend via props
  and theme tokens.
- **Theme plumbing:** `.dark` class on `<html>` via `src/lib/theme.ts` (OS
  `prefers-color-scheme` default, `converge-theme` localStorage override, flash-free
  inline script in `index.html`). `cn()` helper in `src/lib/utils.ts`.

Rules: color/type/radius tokens come only from `globals.css`; semantic colors for
strengths/risks/rejects must stay mountain/valley/avoid (never add new ones); touch
targets ≥44px and inputs ≥16px are hard rules; verify WCAG AA (text) / 3:1
(boundaries) after any palette change.

## Design workflow (impeccable skill)

- All UI/design work runs through the `impeccable` skill (`.agents/skills/impeccable/`). Once per session run `node .agents/skills/impeccable/scripts/context.mjs` and follow its directives.
- New surfaces follow the `impeccable` new-work flow (`shape <surface>` / new-work) before code, using the Miura world above; `init` is already done.
- **Mobile-first product.** This is a mobile-first, thumb-driven product that expands responsively to desktop. In the batched verification round the impeccable skill runs desktop and mobile together — mobile is the primary pass; treat a surface as broken until it is verified at phone width first. Mobile-first UI constraints (touch targets ≥44px, ≥16px inputs, safe-area insets, `100dvh`) are part of the engineering baseline, not polish.
- After finishing web UI edits, run the detector once: `node .agents/skills/impeccable/scripts/detect.mjs --json <changed targets>`.
- Use the installed skill subagents (documenter, asset-producer, finish-reviewer, manual-edit-applier) where a reference file directs; their configs live in `.agents/skills/impeccable/agents/`.

## Don't edit the harness

- `.agents/skills/` is the locked skill harness — sources are recorded in `skills-lock.json` (GitHub repos, hashed). Hand-editing skill files will be overwritten by the next lock update. Modify config in `opencode.json` instead.
- `skills-lock.json` and `.agents/skills/` are managed files; treat them as read-only.

## Security (non-negotiable)

- **No secrets in frontend code.** Vite bakes `VITE_*` env vars into the client bundle — everything under `src/` is public and served to every visitor. Never put API keys, tokens, or credentials in client code or committed config; route any credentialed call through a backend or proxy. Never commit `.env*` files.
- **Treat scraped/remote content as untrusted.** Converge orchestrates web scraping; content from third-party pages is attacker-influenced. Render it as text, escape by default, and avoid `dangerouslySetInnerHTML`. If raw HTML is ever needed, sanitize with an allowlist library.
- **OWASP baseline:** validate and constrain all user input (server-side validation is authoritative, never client-only); no SQL/paths built from raw input; restrictive `Content-Security-Policy`; keep dependencies current and audit them (`npm audit`); set security headers on deploy.
- **Auth & data:** Supabase Auth is the decided path — follow the Supabase skill's security rules (RLS on every table, ownership predicates, never `TO authenticated` alone, never `user_metadata` in authorization). Follow OWASP session management (HttpOnly cookies, CSRF protection). Keep sensitive data encrypted at rest and apply RLS to shared/guest access.

## Engineering standards

- **Mobile-first responsive:** design from a mobile base and layer complexity up with `min-width` breakpoints (never desktop-first `max-width`). Touch targets ≥44px, inputs ≥16px (prevents iOS zoom), safe-area insets, `100dvh` viewport handling. Verify mobile before desktop.
- **DRY with judgment:** no copy-paste logic; extract on the second/third use, not the first. Prefer small composable functions and composition over inheritance.
- **Single responsibility:** one component/function does one job; keep presentational components free of data-fetching orchestration where feasible.
- **TypeScript:** strict typing, no `any` leakage; shared domain types are defined once and imported, never redeclared.
- **Accessibility:** semantic HTML, keyboard-operable controls, labeled inputs, visible focus — target WCAG AA.
- **Performance:** the PWA install + cloud-backed data model means a lean JS bundle and working offline behavior; lazy-load heavy screens and keep dependencies minimal.

## Tooling available

- `opencode.json` enables the **playwright** MCP (browser verify, screenshots) and **shadcn** MCP (registry components) servers — use them rather than assuming they're absent.
- No image-conversion tools installed (cwebp/sips/magick/ffmpeg) — ship PNG output unconverted.
