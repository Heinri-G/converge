-- 0010_reword_coffee_gate — plain user-facing labels and question copy for the
-- coffee-espresso proof domain. Display-only text change: branch ids, tier keys,
-- option `value`s (branch references), weights, and ordering are untouched.
-- See docs/implementation/11-research-flow-ux.md. 0004 was applied by hand on
-- the cloud project, so this UPDATEs the rows that migration seeded.

update public.domain_branches
set label = 'Quick & simple',
    description = 'A no-fuss setup that fits small spaces and busy mornings.'
where slug = 'capsule' and domain_slug = 'coffee-espresso';

update public.domain_branches
set label = 'Compact & manual',
    description = 'A hands-on routine that stays out of the way.'
where slug = 'manual-filter' and domain_slug = 'coffee-espresso';

update public.domain_branches
set label = 'Everyday espresso',
    description = 'A repeatable espresso routine with a gentle learning curve.'
where slug = 'entry-espresso' and domain_slug = 'coffee-espresso';

update public.domain_branches
set label = 'Enthusiast setup',
    description = 'A dedicated counter setup for tuning the whole ritual.'
where slug = 'prosumer' and domain_slug = 'coffee-espresso';

update public.gate_questions
set prompt = 'How much counter space can this setup claim?',
    tooltip = 'Footprint is the first real tradeoff — something that must pack away can''t be a bulky counter fixture.',
    options = '[
      {"value":"00000000-0000-0000-0000-000000000302","label":"It has to pack away each use"},
      {"value":"00000000-0000-0000-0000-000000000303","label":"It can keep a small corner"},
      {"value":"00000000-0000-0000-0000-000000000304","label":"It can own the counter"}
    ]'::jsonb
where id = '00000000-0000-0000-0000-000000000401';

update public.gate_questions
set prompt = 'How involved do you want the daily routine to be?',
    tooltip = 'More control usually means more steps every brew — worth knowing before you commit.',
    options = '[
      {"value":"00000000-0000-0000-0000-000000000303","label":"Keep it simple and repeatable"},
      {"value":"00000000-0000-0000-0000-000000000304","label":"I want to dial it in each time"}
    ]'::jsonb
where id = '00000000-0000-0000-0000-000000000402';

update public.gate_questions
set prompt = 'What matters most in the next machine?',
    tooltip = 'Speed, consistency, and room to tinker pull in different directions — pick the one that steers the search.',
    options = '[
      {"value":"00000000-0000-0000-0000-000000000303","label":"Consistency, every single time"},
      {"value":"00000000-0000-0000-0000-000000000304","label":"Room to experiment and improve"}
    ]'::jsonb
where id = '00000000-0000-0000-0000-000000000403';
