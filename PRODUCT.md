# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + React SPA (user-confirmed), responsive web app installable as a PWA; no deploy target specified. Backend is Supabase (Auth, Postgres with row-level security, Edge Functions for scraping/sentiment). Sentiment extraction is LLM-based, executed server-side. Full technical map: ARCHITECTURE.md.

## Users

Consumer doing consequential local research — choosing among localized services, gear, or hobby options. Their situation: hours spent wading through marketing hype, domain jargon, and endless review pages, often trapped in hyper-niche rabbit holes or repeating the same manual searches months later. Their job: reach a short list of actionable, trustworthy options and decide, without setup burden or endless loops.

## Product Purpose

An interactive research engine that orchestrates web scraping, geo-distance mapping, and sentiment extraction while keeping the user in full control through adaptive decision gates. It synthesizes complex domains into actionable options and persists finished research as a reusable knowledge base, countering "research fatigue."

## Positioning

Open decision. The stated mechanism: orchestration of web scraping, geo-distance mapping, and sentiment extraction behind adaptive decision gates, with persistent storage as a zero-re-research knowledge base and explicit user control. The sharper competitive claim ("what a competitor could not truthfully copy") is undecided and must not be invented.

## Operating Context

- Mobile-first: primary use is on a phone — one hand, thumb reach, on-the-go — installed as a PWA; desktop is a first-class responsive expansion of the same experience, never a separate design.
- Recurring over months: research is re-visited and repeated across sessions; signed-in users get persistent history in Supabase and can reopen/increment old reports.
- Guest sessions run locally (client-side) without an account; signing in promotes them to the cloud and unlocks save, history, sync, and sharing.
- Domain content is noisy: marketing copy, jargon, reviews, and scattered local listings.

## Capabilities and Constraints

Confirmed from the brief:
- Orchestrates web scraping, geo-distance mapping, and sentiment extraction (LLM-based, server-side).
- Adaptive domain mapping: tiers (Capsule → Manual Filter → Entry Espresso → Prosumer) with 2–3 high-impact branching questions and explanatory tooltips.
- Anti-rabbit-hole controls: decision depth capped at 2 levels; one-click "Fast Track / Good Enough" escape hatch.
- Localized filters by drive-time radius; red-flag sentiment from deep review parsing (Reddit, specialized forums).
- Actionable synthesis: comparison matrix, Top 3 Recommended Options, and explicit "Options to Avoid" (Anti-Picks).
- Persistent storage in Supabase: reports and state histories form a zero-re-research personal knowledge base; reports can be shared.
- Authentication via Supabase Auth; guest research is possible without an account.
- Mobile-first responsive web app installable as a PWA; the same experience expands to desktop.

Undecided (record, do not invent):
- Geo / drive-time provider and LLM provider for sentiment.
- Specific scrape sources, adapters, and rate-limit/ToS compliance.
- Sharing model details (public link vs explicit user grants).
- Positioning/differentiator (see Positioning).
- Brand, voice, and naming beyond the project name "Converge."

## Product Principles

- Mobile-first: designed for phones first — thumb-driven, glanceable, usable one-handed on the go. Desktop is a first-class responsive expansion of the same experience, never a separate design or a port.
- Keep the user in control: automation assists; the user decides through adaptive gates, with an escape hatch that never traps them.
- Kill the rabbit hole: hard-capped decision depth and synthesis compress noisy domains into a decision-ready shortlist, never more information to wade through.
- Cloud-backed, guest-first: Supabase is the source of truth for signed-in users, but anyone can research immediately without an account; guest sessions stay local until the user opts in.
- Zero re-research: finished reports persist as a personal knowledge base that can be reopened, incremented, and shared — never repeat the manual work.
- Respect the user's time: no excessive setup and no endless loops.

## Accessibility & Inclusion

No product-specific requirement established.
