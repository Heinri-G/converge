import { z } from 'zod'

export const researchObjectiveSchema = z.enum([
  'best_overall',
  'best_value',
  'lowest_cost',
  'closest',
  'highest_quality',
  'lowest_risk',
])

const constraintSchema = z.object({
  maxPrice: z.number().finite().nonnegative().optional(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  maxDriveMinutes: z.number().int().min(1).max(120).optional(),
  minRating: z.number().finite().min(0).max(5).optional(),
  availableBy: z.string().max(100).optional(),
})

const locationSchema = z.object({
  address: z.string().min(1).max(200).optional(),
  lat: z.number().finite().min(-90).max(90).optional(),
  lng: z.number().finite().min(-180).max(180).optional(),
})

export const researchIntentSchema = z.object({
  topic: z.string().min(2).max(200),
  domain: z.string().min(1).max(100),
  objective: researchObjectiveSchema,
  hardConstraints: constraintSchema,
  preferences: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  location: locationSchema.optional(),
})

export type ResearchObjective = z.infer<typeof researchObjectiveSchema>
export type ResearchIntent = z.infer<typeof researchIntentSchema>

function inferObjective(prompt: string): ResearchObjective {
  const valueTerms = /best value|value for money|bang for|budget/i
  const costTerms = /cheapest|lowest cost|least expensive|under budget/i
  const qualityTerms = /highest quality|best quality|premium|top quality/i
  const riskTerms = /reliable|fewest defects|lowest risk|least risky/i
  const closestTerms = /closest|nearest|shortest drive|nearby/i

  if (valueTerms.test(prompt)) return 'best_value'
  if (costTerms.test(prompt)) return 'lowest_cost'
  if (qualityTerms.test(prompt)) return 'highest_quality'
  if (riskTerms.test(prompt)) return 'lowest_risk'
  if (closestTerms.test(prompt)) return 'closest'
  return 'best_overall'
}

function inferDomain(prompt: string): string {
  const normalized = prompt.toLowerCase()
  if (/golf/.test(normalized)) return 'golf'
  if (/espresso|coffee machine|coffee setup/.test(normalized)) return 'coffee-espresso'
  if (/laptop|notebook/.test(normalized)) return 'laptops'
  if (/bike|bicycle|cycling/.test(normalized)) return 'bikes'
  if (/restaurant|dining|food/.test(normalized)) return 'restaurants'

  const words = normalized
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(
      (word) => word.length > 3 && !['best', 'find', 'under', 'within', 'minutes'].includes(word),
    )
    .slice(0, 3)
  return words.length > 0 ? words.join('-') : 'general-research'
}

function inferCurrency(prompt: string): string | undefined {
  if (/€|\beur\b/i.test(prompt)) return 'EUR'
  if (/£|\bgbp\b/i.test(prompt)) return 'GBP'
  if (/\$|\busd\b/i.test(prompt)) return 'USD'
  return undefined
}

function inferPrice(prompt: string): number | undefined {
  const match = prompt.match(
    /(?:under|less than|below|up to|maximum|max|budget(?: of)?)\s*(?:€|£|\$|eur|gbp|usd)?\s*(\d+(?:[.,]\d{1,2})?)/i,
  )
  if (!match?.[1]) return undefined
  const value = Number(match[1].replace(',', '.'))
  return Number.isFinite(value) ? value : undefined
}

function inferDriveMinutes(prompt: string): number | undefined {
  const match = prompt.match(/within\s+(\d+)\s*(?:min|mins|minutes)/i)
  if (!match?.[1]) return undefined
  const value = Number(match[1])
  return Number.isInteger(value) && value > 0 && value <= 120 ? value : undefined
}

function inferAddress(prompt: string): string | undefined {
  const match = prompt.match(/\b(?:of|near|around)\s+([^,.;]+)/i)
  const address = match?.[1]?.trim()
  return address && address.length <= 200 ? address : undefined
}

export function deriveResearchIntent(prompt: string, domainOverride?: string): ResearchIntent {
  const topic = prompt.trim().slice(0, 200)
  const maxPrice = inferPrice(topic)
  const maxDriveMinutes = inferDriveMinutes(topic)
  const address = inferAddress(topic)
  const objective = inferObjective(topic)
  const intent = {
    topic: topic || 'General research',
    domain: domainOverride ?? inferDomain(topic),
    objective,
    hardConstraints: {
      ...(maxPrice === undefined ? {} : { maxPrice }),
      ...(inferCurrency(topic) === undefined ? {} : { currency: inferCurrency(topic) }),
      ...(maxDriveMinutes === undefined ? {} : { maxDriveMinutes }),
    },
    preferences: {
      budgetFocused: objective === 'best_value' || objective === 'lowest_cost',
    },
    ...(address ? { location: { address } } : {}),
  }

  return researchIntentSchema.parse(intent)
}

export function objectiveLabel(objective: ResearchObjective): string {
  return {
    best_overall: 'Best overall fit',
    best_value: 'Best value for money',
    lowest_cost: 'Lowest cost',
    closest: 'Closest option',
    highest_quality: 'Highest quality',
    lowest_risk: 'Lowest risk',
  }[objective]
}
