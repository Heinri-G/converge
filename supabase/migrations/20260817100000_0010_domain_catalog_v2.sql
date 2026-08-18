-- 0010_domain_catalog_v2 — self-populating domain attribute catalogs.
--
-- The catalog is a cache, not a constraint: `__core__` applies to every
-- domain, authored rows (coffee-espresso, tents) bootstrap quality, and
-- `promote-catalog` writes `source = 'generated'` rows on first use of an
-- unknown domain. Runtime writes go through that function only.
--
-- Template T4: catalog rows are readable by guests and signed-in users; there
-- are no write policies here. `domain_attributes.target_*` maps an answer onto
-- a ResearchIntent field (constraint or preference), so `applyGateAnswers`
-- stays deterministic.

create table public.domain_catalogs (
  id uuid primary key default gen_random_uuid(),
  domain_slug text not null,
  status text not null default 'draft'
    check (status in ('draft', 'curated')),
  source text not null default 'generated'
    check (source in ('authored', 'generated')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (domain_slug)
);

create table public.domain_attributes (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null references public.domain_catalogs(id) on delete cascade,
  slug text not null,
  label text not null,
  prompt text not null,
  tooltip text not null,
  answer_type text not null check (answer_type in ('single', 'boolean')),
  options jsonb not null,
  keywords text[] not null default '{}',
  priority int not null default 1,
  ordering int not null default 0,
  target_kind text not null check (target_kind in ('constraint', 'preference')),
  target_field text not null,
  target_value_type text not null check (target_value_type in ('number', 'string', 'boolean')),
  unique (catalog_id, slug)
);

alter table public.domain_catalogs enable row level security;
alter table public.domain_attributes enable row level security;

create policy "domain_catalogs catalog read" on public.domain_catalogs for select
  to anon, authenticated using (true);

create policy "domain_attributes catalog read" on public.domain_attributes for select
  to anon, authenticated using (true);

create index domain_catalogs_domain_idx on public.domain_catalogs (domain_slug);
create index domain_attributes_catalog_ordering_idx
  on public.domain_attributes (catalog_id, priority, ordering);

grant select on public.domain_catalogs to anon, authenticated;
grant select on public.domain_attributes to anon, authenticated;

-- Seed: `__core__` applies to every domain (universal decision variables).
insert into public.domain_catalogs
  (id, domain_slug, status, source)
values
  ('00000000-0000-0000-0000-000000000501', '__core__', 'curated', 'authored'),
  ('00000000-0000-0000-0000-000000000502', 'coffee-espresso', 'curated', 'authored'),
  ('00000000-0000-0000-0000-000000000503', 'tents', 'curated', 'authored');

insert into public.domain_attributes
  (id, catalog_id, slug, label, prompt, tooltip, answer_type, options, keywords,
   priority, ordering, target_kind, target_field, target_value_type)
values
  -- __core__
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000501',
   'budget', 'Budget ceiling',
   'What''s the most you''re willing to spend?',
   'A hard ceiling filters out options above it and shapes how value is ranked.',
   'single',
   '[
     {"value":"100","label":"Under 100"},
     {"value":"200","label":"Under 200"},
     {"value":"500","label":"Under 500"},
     {"value":"1000","label":"Under 1000"}
   ]'::jsonb,
   array['budget','under','price','cost','max','spend'],
   1, 0, 'constraint', 'maxPrice', 'number'),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000501',
   'min_rating', 'Minimum rating',
   'What''s the lowest rating you''d accept?',
   'A rating floor cuts out options that consistently disappoint owners.',
   'single',
   '[
     {"value":"3","label":"3.0 and up"},
     {"value":"3.5","label":"3.5 and up"},
     {"value":"4","label":"4.0 and up"},
     {"value":"4.5","label":"4.5 and up"}
   ]'::jsonb,
   array['rating','stars','rated','review score'],
   2, 1, 'constraint', 'minRating', 'number'),
  ('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000501',
   'availability', 'Availability',
   'How soon do you need it?',
   'Availability separates a decision you can sit on from one that has to close now.',
   'single',
   '[
     {"value":"now","label":"Need it soon"},
     {"value":"flexible","label":"Can wait a bit"},
     {"value":"any","label":"No deadline"}
   ]'::jsonb,
   array['available','stock','in stock','deliver','shipping','soon'],
   3, 2, 'constraint', 'availableBy', 'string'),

  -- coffee-espresso (ported from the seeded gate_questions)
  ('00000000-0000-0000-0000-000000000611', '00000000-0000-0000-0000-000000000502',
   'footprint', 'Counter footprint',
   'How much counter space can this setup claim?',
   'Footprint is the first real tradeoff — something that must pack away can''t be a bulky counter fixture.',
   'single',
   '[
     {"value":"pack_away","label":"It has to pack away each use"},
     {"value":"small_corner","label":"It can keep a small corner"},
     {"value":"own_counter","label":"It can own the counter"}
   ]'::jsonb,
   array['counter','footprint','space','pack away','portable','compact'],
   1, 0, 'preference', 'footprint', 'string'),
  ('00000000-0000-0000-0000-000000000612', '00000000-0000-0000-0000-000000000502',
   'routine', 'Daily routine',
   'How involved do you want the daily routine to be?',
   'More control usually means more steps every brew — worth knowing before you commit.',
   'single',
   '[
     {"value":"simple","label":"Keep it simple and repeatable"},
     {"value":"dialed_in","label":"I want to dial it in each time"}
   ]'::jsonb,
   array['simple','quick','manual','dial','involved','routine'],
   2, 1, 'preference', 'routine', 'string'),
  ('00000000-0000-0000-0000-000000000613', '00000000-0000-0000-0000-000000000502',
   'priority', 'Machine priority',
   'What matters most in the next machine?',
   'Speed, consistency, and room to tinker pull in different directions — pick the one that steers the search.',
   'single',
   '[
     {"value":"consistency","label":"Consistency, every single time"},
     {"value":"experiment","label":"Room to experiment and improve"}
   ]'::jsonb,
   array['consistency','experiment','tinker','speed'],
   3, 2, 'preference', 'priority', 'string'),

  -- tents (proof domain for product research)
  ('00000000-0000-0000-0000-000000000621', '00000000-0000-0000-0000-000000000503',
   'occupancy', 'Occupancy',
   'How many people should it sleep?',
   'Occupancy drives floor area, packed weight, and price more than any other spec.',
   'single',
   '[
     {"value":"1-2","label":"1–2 people"},
     {"value":"3-4","label":"3–4 people"},
     {"value":"5+","label":"5 or more"}
   ]'::jsonb,
   array['person','people','sleeper','berth','man tent','occupancy','2 person','4 person'],
   1, 0, 'preference', 'occupancy', 'string'),
  ('00000000-0000-0000-0000-000000000622', '00000000-0000-0000-0000-000000000503',
   'waterproofing', 'Waterproofing',
   'Does it need to keep you dry in heavy rain?',
   'Hydrostatic-head rating (HH) is the honest waterproofing number; seams and fly coverage matter too.',
   'single',
   '[
     {"value":"heavy","label":"Yes — heavy rain"},
     {"value":"light","label":"Light rain only"},
     {"value":"none","label":"No strong requirement"}
   ]'::jsonb,
   array['waterproof','water resistant','water-resist','hh','hydrostatic','rain','weatherproof'],
   2, 1, 'preference', 'waterproofing', 'string'),
  ('00000000-0000-0000-0000-000000000623', '00000000-0000-0000-0000-000000000503',
   'season', 'Season rating',
   'When will you use it most?',
   '3-season tents ventilate for summer but collapse under snow load; 4-season adds poles and weight.',
   'single',
   '[
     {"value":"summer","label":"Summer"},
     {"value":"3-season","label":"Three seasons"},
     {"value":"4-season","label":"Four seasons / winter"}
   ]'::jsonb,
   array['3 season','4 season','four season','summer','winter','snow','season'],
   3, 2, 'preference', 'season', 'string'),
  ('00000000-0000-0000-0000-000000000624', '00000000-0000-0000-0000-000000000503',
   'blackout', 'Blackout',
   'Does morning light bother you?',
   'Blackout fabric blocks early light and adds some weight — a real decision for family camping.',
   'boolean',
   '[]'::jsonb,
   array['blackout','dark','light blocking','sleep in'],
   4, 3, 'preference', 'blackout', 'boolean'),
  ('00000000-0000-0000-0000-000000000625', '00000000-0000-0000-0000-000000000503',
   'packability', 'Packability',
   'How much packed size and weight are you OK with?',
   'Packed volume decides whether this is a car-camping tent or a backpacking one.',
   'single',
   '[
     {"value":"light","label":"Lightweight for hiking"},
     {"value":"backpack","label":"Backpack-friendly"},
     {"value":"car","label":"Car camping is fine"}
   ]'::jsonb,
   array['lightweight','packable','backpack','weight','car camping','compact'],
   5, 4, 'preference', 'packability', 'string');