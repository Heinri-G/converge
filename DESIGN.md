---
name: Converge
description: A deployable origami spec sheet — matte paper, near-black ink, one gold foil accent.
colors:
  paper: "#fbfaf6"
  ink: "#1a1a17"
  ink-soft: "#6b6a61"
  gold: "#b8892f"
  gold-deep: "#a97e1f"
  gold-ink: "#191a17"
  card: "#ffffff"
  gold-soft: "#f3e7c9"
  gold-soft-ink: "#5f4a18"
  mountain: "#6f736c"
  valley: "#51729c"
  avoid: "#b23c2c"
  seam: "#e5e0d1"
  input-line: "#90897a"
  night: "#181a18"
  night-ink: "#ece8dc"
  night-card: "#1f221e"
  night-gold: "#d9b054"
  night-gold-ink: "#191507"
typography:
  display:
    fontFamily: "'Geist Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.7rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Geist Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "'Geist Mono Variable', ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.22em"
    textTransform: "uppercase"
  input:
    fontFamily: "'Geist Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  compact:
    fontFamily: "'Geist Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "12.8px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
  spec-id:
    fontFamily: "'Geist Mono Variable', ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "5px"
  lg: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.gold-ink}"
    rounded: "{rounded.md}"
    height: "44px"
  button-primary-hover:
    backgroundColor: "color-mix(in oklch, var(--primary), var(--foreground) 20%)"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    borderColor: "{colors.input-line}"
    rounded: "{rounded.md}"
    height: "44px"
  badge-crease:
    rounded: "{rounded.sm}"
    padding: "2px 6px"
---

## Overview

Converge is a **Miura-fold spec sheet**: a piece of matte paper that folds flat for
carrying and deploys into a full decision spread. The world is engineering-driven —
research is folded into a packet, then pulled open into a shortlist. The paper is
`#fbfaf6`, the ink is near-black `#1a1a17`, and exactly one material — a **gold foil
crease** `#b8892f` — owns the single "deploy" affordance and all primary actions.

The core metaphor runs through every surface:

- A research question **deploys** (the primary action) out of a flat packet.
- **Mountain creases** `∧` are *strengths* (what you can lean on) — warm gray.
- **Valley creases** `∨` are *risks* (what folds away) — pale steel blue.
- **Cut lines** `×` mark *rejects* — dusty red.
- Every item is a **spec card** with a mono spec-ID (`BRV-01`), meta line, and a
  crease mark, joined by **hairline seams**.

The aesthetic is quiet, precise, and material-true: small radii, hairline borders,
spec-mono labels, and color that is *committed* rather than decorative. Nothing
gradients, nothing floats in the air — paper lies flat, and the gold is the one thing
that stands up.

**Modes.** Light-first (daylight, on-the-go) with a matte **night-slate** companion
(`#181a18`). Both are the same sheet — night is the packet folded closed. Dark mode
follows the OS by default (`initTheme` in `src/lib/theme.ts`) and must never re-theme
the metaphor: gold, mountain, valley, and seam all translate 1:1 into night values.

## Colors

Palette primitives live as shadcn tokens in `src/styles/globals.css` (`:root` and
`.dark`); the Tailwind color surface (`--color-*` → `@theme inline`) exposes the
semantic classes used in code.

**Ground & ink**

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#fbfaf6` paper | `#181a18` night | App ground |
| `--foreground` | `#1a1a17` ink | `#ece8dc` night-ink | Body text, headings |
| `--card` | `#ffffff` | `#1f221e` | Spec cards on paper |
| `--muted` / `--muted-foreground` | `#f4f1e9` / `#6b6a61` | `#262924` / `#a8a69b` | Secondary text, fills |
| `--secondary` | `#f1eee4` | `#2a2d28` | Ghost/secondary actions |
| `--border` | `#e5e0d1` seam | `rgba(236,232,220,.14)` | Hairlines, dividers |
| `--input` | `#90897a` | `rgba(236,232,220,.38)` | Interactive field boundary |

**The one accent: gold.** `--primary` `#b8892f` (light) / `#d9b054` (night), with
`--primary-foreground` near-black ink. Gold is reserved for: primary buttons, the
active tab, focus rings (`--ring` `#a97e1f` / `#d9b054`), and the "deploy" affordance.
Never fill a whole surface with gold — it is the foil you use sparingly.

**Semantic creases** (map to `bg-mountain`, `text-valley`, `bg-avoid`, etc.):

- `--mountain` `#6f736c` / `#a7aca2` — strengths. Warm gray reads solid, load-bearing.
- `--valley` `#51729c` / `#9db9dc` — risks. Pale steel blue reads *away*, folded under.
- `--avoid` `#b23c2c` / `#e08f76` — rejects. Dusty red, only for things you cut.

**The One Gold Rule.** Gold never floods a surface. It owns primary actions, the
active tab, focus rings, and the single deploy affordance — nothing else. Its rarity
is the point.

**The Crease Rule.** Strengths are always mountain (warm gray), risks always valley
(pale steel blue), rejects always cut-line red. Never introduce new semantic colors
for these — the fold semantics stay fixed.

All body-size text pairs clear WCAG AA (≥4.5:1) in both modes; interactive boundaries
(input, ring) clear ≥3:1. Verified programmatically in the build check — do not shift
a hex value without re-running the contrast table in `AGENTS.md`/verification.

## Typography

Two families, both variable Geist from Fontsource (bundled, no network fonts):

- **`--font-sans`** — `Geist Variable`. Workhorse for all body, headings, UI.
- **`--font-mono`** — `Geist Mono Variable`. Only for **spec-ID** text and
  **engineering labels**: item IDs (`BRV-01`), meta (`15m · $449`), section kickers.

The type scale is small, tight, and unromantic:

- **Display** (the home hero, report titles): `1.7rem` / 600 / `-0.01em`. Max one per
  screen. Use `text-balance` on mobile.
- **Body**: `15px` / 400 / 1.5.
- **Kicker label**: mono, `11px`, uppercase, `0.22em` tracking, `text-muted-foreground`
  or `text-gold` for the primary deploy invitation.
- **Input**: `16px` minimum on all form fields (prevents iOS focus zoom) — never drop.
- **Compact**: `12.8px` (shadcn `sm` size) is reserved for compact desktop button
  labels; not used for body or inputs.
- **Spec-ID**: mono, `10px`, `text-muted-foreground`, no tracking.

Rules: uppercase mono labels never go below `10px`; body text never below `15px` on
mobile (16px for inputs, see Layout); never set prose in mono.

**The Spec-ID Rule.** Every candidate in a decision list carries a mono spec-ID
(`BRV-01`), a meta line, and a crease mark. Prose is never set in mono.

## Layout

Mobile-first, thumb-driven, `min-width` breakpoints only (`640px`, `1024px`).

- **Mobile:** a slim top bar (brand + gold tab) and a bottom tab bar with three items
  (Home / Research / History). Bottom bar rests inside `--safe-bottom`; active tab is
  `--accent` (gold-soft) fill with `--accent-foreground`.
- **Desktop (≥1024px):** the same three items become a fixed **left side rail**
  (`240px`, `--side-nav-w`), brand on top; the content column sits beside it. Never a
  second top bar and never a hamburger — the three destinations are always visible.
- **Page gutters:** `16px` on mobile, `24px` at desktop; content max-width `40rem`
  (mobile) / `48rem` (desktop) so decision lists read as a column of spec cards.
- **Touch baseline (hard rules):** interactive targets ≥ `44px` (`--touch-min`), inputs
  ≥ `16px` font-size (prevents iOS focus zoom), `--safe-top`/`--safe-bottom` respected,
  viewport height uses `100dvh` (`h-dvh`).

**The Touch Rule.** Interactive targets never drop below 44px and inputs never below
16px — the mobile-first baseline is a hard rule, not polish.

## Elevation & Depth

The paper lies flat — there is no floating. Depth is expressed by **creases and
seams**, not shadows:

- Spec cards are distinguished by a **hairline ring** (`ring-foreground/8`) and a
  `#ffffff` ground against paper, plus a 1px seam shadow (`--shadow-seam`).
- The only elevated object in the world is the **gold packet** when it deploys: a
  single, small, warm lift (`--shadow-lift`) that reads as foil standing up — used on
  primary actions during press/spring, never as resting decoration.
- Reject rows use a thin `ring-avoid/30` instead of any heavier treatment.

**The Flat-By-Default Rule.** The paper lies flat. Depth comes from hairline seams
and the white-card ring, not shadows. The gold packet is the only object in the world
that lifts, and only during press/spring.

## Shapes

- **Radius:** `--radius: 0.25rem` (4px) — the sheet's fold. Buttons/cards/inputs land
  on `rounded-lg` (4px), badges on `rounded-sm` (2px), pills reserved for the small
  counter badge (`rounded-4xl`).
- **Seams:** `1px` hairline borders (`--border`) for dividers, header/nav bottoms,
  and card edges. Hard corners are the default; radius only where a fold would occur.
- **Crease marks:** the glyph set `∧` `∨` `×` rendered in mono on a 10%-tint chip of
  the semantic color (`bg-mountain/10 text-mountain` etc.) — 2px radius, no border.

## Components

Composed from the shadcn/ui base (`src/components/ui`) — do not fork the primitives;
extend via props and tokens. Shell (`src/app/ui/AppShell.tsx`) is Tailwind only.

- **Button** — primary = gold fill, ink text; `outline` = seam border, paper ground;
  `ghost` = muted text. Minimum 44px height enforced globally. Press: 1px translate;
  focus: 2px gold ring with 2px offset. Active tab uses the gold-soft accent, not a
  full gold fill.
- **Input** — paper fill, `--input` boundary (≥3:1), `text-base` on mobile (16px).
  Placeholder `text-muted-foreground`. Focus ring gold, 3px with 50% alpha.
- **Card** — white ground, hairline ring + seam shadow, spec layout inside:
  `spec-id · name / meta · crease-chip`.
- **Badge** — pills for counts; 2px-radius chips (`rounded-sm`) for crease marks.
- **Bottom sheet / Sheet** — paper ground, hairline top seam; for decision gates and
  share on mobile (thumb reach). Desktop renders the same content inline.

## Do's and Don'ts

**Do**

- Deploy the gold: one primary action per surface, always gold, always with ink text.
- Label every candidate with a mono spec-ID; include a meta line and a crease mark.
- Use `text-muted-foreground` for anything secondary, `--muted` for hover fills.
- Keep seams hairlines: 1px, `--border`, hard corners except where a fold lands.
- Let dark mode follow the OS; keep the metaphor identical, only the values change.
- Verify contrast after any palette change (AA for text, 3:1 for boundaries).

**Don't**

- Don't flood surfaces with gold, gradient the paper, or drop heavy shadows (the
  world is flat — the packet is the only lift).
- Don't write prose in mono, or drop spec-IDs below 10px / labels below 11px.
- Don't introduce new semantic colors for strengths/risks/rejects — they must stay
  mountain/valley/avoid.
- Don't use `max-width` responsive rules or hide navigation behind a hamburger.
- Don't drop touch sizes below 44px or input fonts below 16px "to save space".
- Don't use emoji or decorative illustrations as stand-ins for the crease glyphs.
