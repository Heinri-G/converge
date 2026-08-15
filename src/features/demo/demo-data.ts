export interface DemoCandidate {
  id: string
  name: string
  source: string
  driveMinutes: number
  rating: number
  crease: 'solid' | 'fold' | 'avoid'
  summary: string
  pros: string[]
  cons: string[]
  defects: string[]
}

export const DEMO_CANDIDATES: DemoCandidate[] = [
  {
    id: 'DEMO-01',
    name: 'Northline Espresso Lab',
    source: 'fixture-local',
    driveMinutes: 12,
    rating: 4.6,
    crease: 'solid',
    summary: 'Synthetic fixture: a compact setup with a short learning curve.',
    pros: ['repeatable workflow', 'small footprint'],
    cons: ['less room to tune'],
    defects: [],
  },
  {
    id: 'DEMO-02',
    name: 'Counterpoint Coffee Works',
    source: 'fixture-forum',
    driveMinutes: 19,
    rating: 4.4,
    crease: 'fold',
    summary: 'Synthetic fixture: more control, with a routine that asks for attention.',
    pros: ['strong control', 'repairable parts'],
    cons: ['longer setup'],
    defects: ['temperature consistency needs a careful warm-up'],
  },
  {
    id: 'DEMO-03',
    name: 'Ritual Bench Roasters',
    source: 'fixture-reviews',
    driveMinutes: 27,
    rating: 3.8,
    crease: 'avoid',
    summary: 'Synthetic fixture: an attractive counter setup with repeated reliability concerns.',
    pros: ['wide adjustment range'],
    cons: ['heavier daily routine'],
    defects: ['multiple owners report inconsistent pressure', 'service access is unclear'],
  },
]

export const DEMO_STEPS = [
  {
    id: 'map',
    label: 'Fold the question',
    title: 'The counter can claim the setup.',
    body: 'The demo answer selects a dedicated counter workflow, then keeps the path to one useful next question.',
  },
  {
    id: 'progress',
    label: 'Run the pull',
    title: 'A bounded pull, not an open tab spiral.',
    body: 'The pipeline geocodes the starting point, filters by drive time, and extracts recurring defects from source text.',
  },
  {
    id: 'candidates',
    label: 'Compare options',
    title: 'Three options survive the first fold.',
    body: 'Each option carries a source label, distance, rating, and a crease that says how much weight to give it.',
  },
  {
    id: 'sentiment',
    label: 'Read the risks',
    title: 'The red flags are part of the answer.',
    body: 'Consensus pros and cons help you choose. Recurring defects tell you what to cut before it costs you time.',
  },
] as const
