-- 0004_domain_catalog — public content for adaptive domain mapping.
-- Template T4: catalog rows are readable by guests and signed-in users; only
-- migrations can write them. The fixed coffee/espresso IDs keep seed option
-- values referentially stable for the first proof domain.

create table public.domain_branches (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.domain_branches(id) on delete cascade,
  domain_slug text not null,
  slug text not null,
  tier text not null
    check (tier in ('capsule', 'manual_filter', 'entry_espresso', 'prosumer')),
  label text not null,
  description text not null default '',
  ordering int not null default 0,
  unique (domain_slug, slug)
);

create table public.gate_questions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.domain_branches(id) on delete cascade,
  prompt text not null,
  tooltip text not null,
  answer_type text not null check (answer_type in ('single', 'boolean')),
  options jsonb not null,
  weight numeric not null default 1,
  ordering int not null default 0
);

alter table public.domain_branches enable row level security;
alter table public.gate_questions enable row level security;

create policy "domain_branches catalog read" on public.domain_branches for select
  to anon, authenticated using (true);

create policy "gate_questions catalog read" on public.gate_questions for select
  to anon, authenticated using (true);

create index domain_branches_domain_ordering_idx
  on public.domain_branches (domain_slug, ordering);
create index gate_questions_branch_ordering_idx
  on public.gate_questions (branch_id, ordering);

grant select on public.domain_branches to anon, authenticated;
grant select on public.gate_questions to anon, authenticated;

insert into public.domain_branches
  (id, parent_id, domain_slug, slug, tier, label, description, ordering)
values
  ('00000000-0000-0000-0000-000000000301', null, 'coffee-espresso', 'capsule',
    'capsule', 'Quick & simple', 'A no-fuss setup that fits small spaces and busy mornings.', 0),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000301',
    'coffee-espresso', 'manual-filter', 'manual_filter', 'Compact & manual',
    'A hands-on routine that stays out of the way.', 1),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000301',
    'coffee-espresso', 'entry-espresso', 'entry_espresso', 'Everyday espresso',
    'A repeatable espresso routine with a gentle learning curve.', 2),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000301',
    'coffee-espresso', 'prosumer', 'prosumer', 'Enthusiast setup',
    'A dedicated counter setup for tuning the whole ritual.', 3);

insert into public.gate_questions
  (id, branch_id, prompt, tooltip, answer_type, options, weight, ordering)
values
  ('00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000301',
    'How much counter space can this setup claim?',
    'Footprint is the first real tradeoff — something that must pack away can''t be a bulky counter fixture.',
    'single',
    '[
      {"value":"00000000-0000-0000-0000-000000000302","label":"It has to pack away each use"},
      {"value":"00000000-0000-0000-0000-000000000303","label":"It can keep a small corner"},
      {"value":"00000000-0000-0000-0000-000000000304","label":"It can own the counter"}
    ]'::jsonb,
    1.4, 0),
  ('00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000302',
    'How involved do you want the daily routine to be?',
    'More control usually means more steps every brew — worth knowing before you commit.',
    'single',
    '[
      {"value":"00000000-0000-0000-0000-000000000303","label":"Keep it simple and repeatable"},
      {"value":"00000000-0000-0000-0000-000000000304","label":"I want to dial it in each time"}
    ]'::jsonb,
    1.1, 0),
  ('00000000-0000-0000-0000-000000000403',
    '00000000-0000-0000-0000-000000000303',
    'What matters most in the next machine?',
    'Speed, consistency, and room to tinker pull in different directions — pick the one that steers the search.',
    'single',
    '[
      {"value":"00000000-0000-0000-0000-000000000303","label":"Consistency, every single time"},
      {"value":"00000000-0000-0000-0000-000000000304","label":"Room to experiment and improve"}
    ]'::jsonb,
    1, 0);
