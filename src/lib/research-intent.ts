import { z } from 'zod'
import type { DomainAttribute, SpecAttribute } from './types'

export type SearchContext = 'place' | 'product'

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

export function isResearchObjective(value: unknown): value is ResearchObjective {
  return researchObjectiveSchema.safeParse(value).success
}

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

const DOMAIN_CONTEXT: Record<string, SearchContext> = {
  golf: 'place',
  restaurants: 'place',
  hotels: 'place',
  beaches: 'place',
  'coffee-espresso': 'product',
  laptops: 'product',
  bikes: 'product',
  tents: 'product',
  cameras: 'product',
  phones: 'product',
  headphones: 'product',
  grills: 'product',
  furniture: 'product',
}

const PLACE_SIGNAL_PATTERN =
  /course|court|field|track|hotel|resort|beach|restaurant|cafe|clinic|gym|studio|salon|barber|dentist|plumber|mechanic|venue|park|museum|trail|tennis|swimming|pool|spa|attraction|hiking|kayak|rental|lessons|classes|repair|service|dine|stay|visit|near me|close to/i

const PRODUCT_SIGNAL_PATTERN =
  /tamper|grinder|machine|laptop|notebook|phone|camera|keyboard|monitor|tablet|headphone|speaker|shoes|bag|jacket|watch|toy|game|console|grill|kettle|blender|chair|desk|lamp|mattress|vacuum|fridge|tv|clubs|kit|gear|accessor|buy|price|model|order|deliver|shipping|amazon|ebay|bol\.com/i

const COUNTRY_NAMES: Record<string, string> = {
  NL: 'Netherlands',
  DE: 'Germany',
  BE: 'Belgium',
  FR: 'France',
  GB: 'United Kingdom',
  IE: 'Ireland',
  ES: 'Spain',
  IT: 'Italy',
  PT: 'Portugal',
  AT: 'Austria',
  CH: 'Switzerland',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  PL: 'Poland',
  US: 'United States',
  CA: 'Canada',
  AU: 'Australia',
  NZ: 'New Zealand',
  JP: 'Japan',
}

const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  netherlands: 'NL',
  holland: 'NL',
  germany: 'DE',
  belgium: 'BE',
  france: 'FR',
  'united kingdom': 'GB',
  uk: 'GB',
  england: 'GB',
  britain: 'GB',
  ireland: 'IE',
  spain: 'ES',
  italy: 'IT',
  portugal: 'PT',
  austria: 'AT',
  switzerland: 'CH',
  sweden: 'SE',
  norway: 'NO',
  denmark: 'DK',
  finland: 'FI',
  poland: 'PL',
  'united states': 'US',
  usa: 'US',
  america: 'US',
  canada: 'CA',
  australia: 'AU',
  'new zealand': 'NZ',
  japan: 'JP',
}

const COUNTRY_SHOP_HINTS: Record<string, string> = {
  NL: 'bol.com, Amazon.nl, independent shops',
  DE: 'Amazon.de, local online shops',
  BE: 'bol.com, Amazon.nl, local online shops',
  GB: 'Amazon.co.uk, local online shops',
  FR: 'Amazon.fr, local online shops',
  US: 'Amazon.com, local online shops',
  CA: 'Amazon.ca, local online shops',
  AU: 'Amazon.com.au, local online shops',
}

const MARKETPLACE_NAMES = new Set([
  'amazon',
  'ebay',
  'bol.com',
  'aliexpress',
  'wish',
  'etsy',
  'coolblue',
])

function inferCountry(prompt: string): string | undefined {
  const normalized = ` ${prompt.toLowerCase().replace(/[^a-z\s]/g, ' ')} `
  for (const [name, code] of Object.entries(COUNTRY_CODE_BY_NAME)) {
    if (normalized.includes(` ${name} `)) return code
  }
  return undefined
}

function countryFromLocale(locale?: string): string | undefined {
  if (!locale) return undefined
  const [language, region] = locale.split('-')
  const candidate = region ?? language
  return candidate && /^[a-z]{2}$/i.test(candidate) && candidate.toUpperCase() in COUNTRY_NAMES
    ? candidate.toUpperCase()
    : undefined
}

function isLocationCandidate(value: string): boolean {
  const normalized = value.toLowerCase()
  return normalized !== 'me' && !MARKETPLACE_NAMES.has(normalized)
}

function inferDriveMinutes(prompt: string): number | undefined {
  const cap = (value: number) => Math.min(120, value)
  const boundedMinutes = prompt.match(
    /(?:within|under|less than|below|max|maximum|no more than|no longer than)\s+(\d+)\s*(?:minutes|mins|min|minute)/i,
  )
  if (boundedMinutes?.[1]) return cap(Number(boundedMinutes[1]))
  const boundedHours = prompt.match(
    /(?:within|under|less than|below|max|maximum|no more than|no longer than)\s+(\d+)\s*(?:hours|hrs|hr|hour)/i,
  )
  if (boundedHours?.[1]) return cap(Number(boundedHours[1]) * 60)
  if (/(?:an|one)\s*hour/i.test(prompt)) return 60
  const driveMinutes = prompt.match(
    /(\d+)\s*(?:minutes|mins|min|minute)\s*(?:drive|away|journey|commute)/i,
  )
  if (driveMinutes?.[1]) return cap(Number(driveMinutes[1]))
  const driveHours = prompt.match(
    /(\d+)\s*(?:hours|hrs|hr|hour)\s*(?:drive|away|journey|commute)/i,
  )
  if (driveHours?.[1]) return cap(Number(driveHours[1]) * 60)
  return undefined
}

function inferAddress(prompt: string, context: SearchContext): string | undefined {
  const nearMatch = prompt.match(/\b(?:of|near|around|close to|from)\s+([^,.;]+)/i)
  const nearCandidate = nearMatch?.[1]?.trim()
  if (nearCandidate && isLocationCandidate(nearCandidate) && nearCandidate.length <= 200) {
    return nearCandidate
  }
  if (context === 'place') {
    const inMatch = prompt.match(/\bin\s+([^,.;]+)/i)
    const candidate = inMatch?.[1]?.trim()
    if (
      candidate &&
      isLocationCandidate(candidate) &&
      inferCountry(candidate) === undefined &&
      candidate.length <= 200
    ) {
      return candidate
    }
  }
  return undefined
}

function hasExplicitPlaceMention(prompt: string): boolean {
  if (/\b(?:of|near|around|close to)\s+\S+/i.test(prompt)) return true
  const inMatch = prompt.match(/\bin\s+([^,.;]+)/i)
  const candidate = inMatch?.[1]?.trim()
  return Boolean(candidate && isLocationCandidate(candidate) && inferCountry(candidate) === undefined)
}

function inferSearchContext(prompt: string, domain: string): SearchContext {
  if (inferDriveMinutes(prompt) !== undefined || hasExplicitPlaceMention(prompt)) return 'place'
  if (PRODUCT_SIGNAL_PATTERN.test(prompt)) return 'product'
  if (PLACE_SIGNAL_PATTERN.test(prompt)) return 'place'
  return DOMAIN_CONTEXT[domain] ?? 'product'
}

const OBJECT_DOMAIN_KEYWORDS: Array<[string, RegExp]> = [
  ['golf', /golf/],
  ['coffee-espresso', /espresso|coffee|tamper|grinder|latte|cappuccino|portafilter/],
  ['laptops', /laptop|notebook/],
  ['bikes', /bike|bicycle|cycling/],
  ['restaurants', /restaurant|dining|food/],
  ['tents', /tent|camping|canopy|sleeping bag|hammock|caravan|camper/],
  ['cameras', /camera|camcorder|dslr|mirrorless/],
  ['phones', /smartphone|mobile|iphone|android phone|cellphone/],
  ['headphones', /headphone|earbud|earbuds|headset/],
  ['grills', /grill|bbq|braai|smoker|kamado/],
  ['furniture', /sofa|couch|mattress|bed frame|dining table|desk chair/],
]

const LOCATION_TOKEN_WORDS = new Set([
  ...Object.keys(COUNTRY_CODE_BY_NAME),
  'near',
  'nearby',
  'around',
  'local',
  'locally',
  'area',
  'region',
  'downtown',
  'neighborhood',
])

function inferDomain(prompt: string): string {
  const normalized = prompt.toLowerCase()
  for (const [domain, pattern] of OBJECT_DOMAIN_KEYWORDS) {
    if (pattern.test(normalized)) return domain
  }

  const words = normalized
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 3 &&
        !DOMAIN_STOP_WORDS.has(word) &&
        !LOCATION_TOKEN_WORDS.has(word),
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

const DOMAIN_STOP_WORDS = new Set([
  'best',
  'find',
  'under',
  'within',
  'minutes',
  'value',
  'money',
  'cheap',
  'good',
  'top',
])

export interface ResearchIntentOptions {
  locale?: string
}

export function deriveResearchIntent(
  prompt: string,
  domainOverride?: string,
  options: ResearchIntentOptions = {},
): ResearchIntent {
  const topic = prompt.trim().slice(0, 200)
  const domain = domainOverride ?? inferDomain(topic)
  const context = inferSearchContext(topic, domain)
  const maxPrice = inferPrice(topic)
  const maxDriveMinutes = inferDriveMinutes(topic)
  const address = inferAddress(topic, context)
  const objective = inferObjective(topic)
  const country = inferCountry(topic) ?? countryFromLocale(options.locale)
  const locallyOrderable = context === 'product'

  const intent = {
    topic: topic || 'General research',
    domain,
    objective,
    hardConstraints: {
      ...(maxPrice === undefined ? {} : { maxPrice }),
      ...(inferCurrency(topic) === undefined ? {} : { currency: inferCurrency(topic) }),
      ...(maxDriveMinutes === undefined ? {} : { maxDriveMinutes }),
    },
    preferences: {
      budgetFocused: objective === 'best_value' || objective === 'lowest_cost',
      context,
      ...(locallyOrderable ? { locallyOrderable: true } : {}),
      ...(context === 'product' && country ? { shippingCountry: country } : {}),
    },
    ...(address ? { location: { address } } : {}),
  }

  return researchIntentSchema.parse(intent)
}

export function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code
}

export const SHIPPING_COUNTRY_CODES = Object.keys(COUNTRY_NAMES) as string[]

export function localShopHint(countryCode?: string): string {
  return countryCode ? (COUNTRY_SHOP_HINTS[countryCode] ?? 'local online shops') : 'local online shops'
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

export function displayDomain(slug: string): string {
  return slug.split('-').join(' ')
}

const AVAILABILITY_PATTERN =
  /(available|order|buy|purchase|deliver|shipping|stocked|in stock|for sale)/i

const SKIPPED_PREFERENCE_KEYS = new Set([
  'context',
  'locallyOrderable',
  'shippingCountry',
  'budgetFocused',
])

export const RESERVED_PREFERENCE_KEYS = SKIPPED_PREFERENCE_KEYS

/** Derives the spec-extraction schema from the settled preferences (gate answers + detected). */
export function specAttributesFromPreferences(
  preferences: Record<string, string | number | boolean>,
): SpecAttribute[] {
  return Object.entries(preferences)
    .filter(([key]) => !RESERVED_PREFERENCE_KEYS.has(key))
    .map(([slug, value]) => ({
      slug,
      label: slug.split('_').join(' '),
      valueType:
        typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string',
    }))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function promptMentions(normalized: string, keyword: string): boolean {
  const term = keyword.toLowerCase().trim()
  if (!term) return false
  if (/\s/.test(term)) return normalized.includes(term)
  const escaped = escapeRegExp(term)
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(normalized)
}

/** Slugs of catalog attributes already stated in the prompt, so the gate skips them. */
export function detectAnsweredAttributeSlugs(
  prompt: string,
  attributes: DomainAttribute[],
): Set<string> {
  const normalized = prompt.toLowerCase()
  const slugs = new Set<string>()
  for (const attribute of attributes) {
    if (attribute.keywords.some((keyword) => promptMentions(normalized, keyword))) {
      slugs.add(attribute.slug)
    }
  }
  return slugs
}

/** Detected values for already-stated attributes (booleans => true, singles => matched term). */
export function answeredAttributeValues(
  prompt: string,
  attributes: DomainAttribute[],
): Record<string, string | boolean> {
  const normalized = prompt.toLowerCase()
  const values: Record<string, string | boolean> = {}
  for (const attribute of attributes) {
    const matched = attribute.keywords.find((keyword) => promptMentions(normalized, keyword))
    if (!matched) continue
    if (attribute.target.valueType === 'boolean') {
      values[attribute.slug] = true
    } else {
      const capture = normalized.match(
        new RegExp(`\\d+\\s*${escapeRegExp(matched.toLowerCase().trim())}`),
      )
      values[attribute.slug] = capture?.[0].trim() ?? matched.trim()
    }
  }
  return values
}

export function preferenceKeywords(
  preferences: Record<string, string | number | boolean>,
): string[] {
  const words = new Set<string>()
  for (const [key, value] of Object.entries(preferences)) {
    if (SKIPPED_PREFERENCE_KEYS.has(key)) continue
    if (typeof value === 'string' && value.trim().length > 0) words.add(value.trim())
    else if (typeof value === 'number' && Number.isFinite(value)) words.add(String(value))
  }
  return [...words]
}

export interface SearchQueryOptions {
  context: SearchContext
  useGeo?: boolean
  address?: string
  radiusMinutes?: number
  locallyOrderable?: boolean
  shippingCountry?: string
  preferences?: Record<string, string | number | boolean>
}

export function buildSearchQuery(
  topic: string,
  domainSlug: string,
  objective: ResearchObjective,
  options: SearchQueryOptions,
): string {
  let query = topic.trim() || `${displayDomain(domainSlug)} ${objectiveLabel(objective)}`.trim()

  if (options.context === 'place' && options.useGeo && options.address?.trim()) {
    query = `${query} near ${options.address.trim()}`.trim()
  } else if (options.context === 'product' && options.locallyOrderable) {
    const mentionsAvailability = AVAILABILITY_PATTERN.test(topic)
    const mentionsCountry = options.shippingCountry
      ? new RegExp(`\\b${options.shippingCountry.toLowerCase()}\\b`).test(topic.toLowerCase())
      : false
    if (!mentionsAvailability && !mentionsCountry) {
      const region = options.shippingCountry
        ? ` available to order in ${countryName(options.shippingCountry)}`
        : ' available to order locally'
      query = `${query}${region}`.trim()
    }
  }

  const keywords = preferenceKeywords(options.preferences ?? {})
  for (const keyword of keywords) {
    if (query.toLowerCase().includes(keyword.toLowerCase())) continue
    query = `${query} ${keyword}`.trim()
  }

  return query.slice(0, 200)
}
