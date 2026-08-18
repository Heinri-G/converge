import type { DomainAttribute, GeneratedGate } from '@/lib/types'

export const MAX_ATTRIBUTE_QUESTIONS = 3

/**
 * Deterministic gate built from a domain's attribute catalog. Used for guests
 * and any path without an LLM call: picks the top-priority attributes that the
 * prompt has not already answered, in the same shape `GroupSheet` renders.
 */
export function createCatalogGate(
  attributes: DomainAttribute[],
  answered: ReadonlySet<string>,
): GeneratedGate {
  const unanswered = attributes
    .filter((attribute) => !answered.has(attribute.slug))
    .slice(0, MAX_ATTRIBUTE_QUESTIONS)

  if (unanswered.length === 0) return { groups: [] }

  return {
    groups: [
      {
        id: 'catalog-questions',
        title: 'A few quick questions',
        rationale: 'A couple of decisions that steer which options fit best.',
        questions: unanswered.map((attribute) => ({
          id: `attr-${attribute.slug}`,
          prompt: attribute.prompt,
          tooltip: attribute.tooltip,
          answerType: attribute.answerType,
          options: attribute.options,
          target: attribute.target,
        })),
      },
    ],
  }
}