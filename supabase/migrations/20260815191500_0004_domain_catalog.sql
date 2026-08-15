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
    'capsule', 'Capsule', 'The smallest useful starting point: clear constraints, little ceremony.', 0),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000301',
    'coffee-espresso', 'manual-filter', 'manual_filter', 'Manual Filter',
    'More control and a compact setup, without turning the counter into a station.', 1),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000301',
    'coffee-espresso', 'entry-espresso', 'entry_espresso', 'Entry Espresso',
    'A repeatable espresso routine with a manageable learning curve.', 2),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000301',
    'coffee-espresso', 'prosumer', 'prosumer', 'Prosumer',
    'A dedicated counter setup for people who want to tune the whole ritual.', 3);

insert into public.gate_questions
  (id, branch_id, prompt, tooltip, answer_type, options, weight, ordering)
values
  ('00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000301',
    'Where will this coffee setup live?',
    'Footprint is the first practical split: a counter fixture asks for a different commitment than a setup that needs to pack away.',
    'single',
    '[
      {"value":"00000000-0000-0000-0000-000000000302","label":"It needs to pack away"},
      {"value":"00000000-0000-0000-0000-000000000303","label":"It can claim a small corner"},
      {"value":"00000000-0000-0000-0000-000000000304","label":"It can own the counter"}
    ]'::jsonb,
    1.4, 0),
  ('00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000302',
    'How much control do you want over the ritual?',
    'More control can improve the cup, but it also adds steps you will repeat every time you brew.',
    'single',
    '[
      {"value":"00000000-0000-0000-0000-000000000303","label":"Keep it repeatable"},
      {"value":"00000000-0000-0000-0000-000000000304","label":"Let me tune it"}
    ]'::jsonb,
    1.1, 0),
  ('00000000-0000-0000-0000-000000000403',
    '00000000-0000-0000-0000-000000000303',
    'What should the next upgrade buy you?',
    'The next constraint matters more than a feature list: speed, consistency, or room to keep learning.',
    'single',
    '[
      {"value":"00000000-0000-0000-0000-000000000303","label":"Fewer variables"},
      {"value":"00000000-0000-0000-0000-000000000304","label":"More room to experiment"}
    ]'::jsonb,
    1, 0);
