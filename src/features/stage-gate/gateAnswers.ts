import type { GateAnswer, GeneratedGate, GateTarget } from '@/lib/types'
import type { ResearchIntent } from '@/lib/research-intent'

function coerceAnswer(answer: GateAnswer, target: GateTarget): string | number | boolean {
  if (target.valueType === 'number') return Number(answer)
  if (target.valueType === 'boolean') return answer === true || answer === 'true'
  return String(answer)
}

/** Deterministically maps generated-gate answers back onto a ResearchIntent. */
export function applyGateAnswers(
  intent: ResearchIntent,
  gate: GeneratedGate,
  answers: Record<string, GateAnswer>,
): ResearchIntent {
  const hardConstraints = { ...intent.hardConstraints }
  const preferences = { ...intent.preferences }

  for (const group of gate.groups) {
    for (const question of group.questions) {
      const answer = answers[question.id]
      if (answer === undefined) continue
      const value = coerceAnswer(answer, question.target)

      if (question.target.kind === 'constraint') {
        const field = question.target.field
        if (field === 'maxPrice' || field === 'minRating' || field === 'maxDriveMinutes') {
          if (typeof value === 'number' && Number.isFinite(value)) hardConstraints[field] = value
        } else if (field === 'availableBy' && typeof value === 'string') {
          hardConstraints.availableBy = value
        }
      } else {
        preferences[question.target.field] = value
      }
    }
  }

  return { ...intent, hardConstraints, preferences }
}

export function parseGeneratedGate(value: unknown): GeneratedGate | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<GeneratedGate>
  if (!Array.isArray(candidate.groups)) return null
  const validGroups = candidate.groups.filter((group) => {
    if (!group || typeof group !== 'object') return false
    return (
      typeof group.id === 'string' &&
      typeof group.title === 'string' &&
      typeof group.rationale === 'string' &&
      Array.isArray(group.questions) &&
      group.questions.length > 0
    )
  })
  if (validGroups.length === 0) return null
  return { groups: validGroups }
}