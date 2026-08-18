import { supabase } from '@/lib/supabase'
import { CORE_CATALOG_SLUG } from '@/lib/types'
import type {
  DomainAttribute,
  DomainBranch,
  DomainCatalog,
  GateOption,
  GateQuestion,
  GateTarget,
} from '@/lib/types'

interface RawBranch {
  id: string
  parent_id: string | null
  domain_slug: string
  slug: string
  tier: DomainBranch['tier']
  label: string
  description: string
  ordering: number
}

interface RawQuestion {
  id: string
  branch_id: string
  prompt: string
  tooltip: string
  answer_type: GateQuestion['answerType']
  options: GateOption[]
  weight: number
  ordering: number
}

function mapBranch(row: RawBranch): DomainBranch {
  return {
    id: row.id,
    parentId: row.parent_id,
    domainSlug: row.domain_slug,
    slug: row.slug,
    tier: row.tier,
    label: row.label,
    description: row.description,
    ordering: row.ordering,
  }
}

function mapQuestion(row: RawQuestion): GateQuestion {
  return {
    id: row.id,
    branchId: row.branch_id,
    prompt: row.prompt,
    tooltip: row.tooltip,
    answerType: row.answer_type,
    options: Array.isArray(row.options) ? row.options : [],
    weight: Number(row.weight),
    ordering: row.ordering,
  }
}

export async function fetchDomainSlugs(): Promise<string[]> {
  const { data, error } = await supabase
    .from('domain_catalogs')
    .select('domain_slug')
    .neq('domain_slug', CORE_CATALOG_SLUG)
    .order('domain_slug')

  if (error) throw error

  const rows = (data ?? []) as Array<{ domain_slug: string }>
  return [...new Set(rows.map((row) => row.domain_slug))]
}

export async function fetchDomainBranches(domainSlug: string): Promise<DomainBranch[]> {
  const { data, error } = await supabase
    .from('domain_branches')
    .select('id, parent_id, domain_slug, slug, tier, label, description, ordering')
    .eq('domain_slug', domainSlug)
    .order('ordering')

  if (error) throw error

  return ((data ?? []) as RawBranch[]).map(mapBranch)
}

export async function fetchGateQuestions(branchId: string): Promise<GateQuestion[]> {
  const { data, error } = await supabase
    .from('gate_questions')
    .select('id, branch_id, prompt, tooltip, answer_type, options, weight, ordering')
    .eq('branch_id', branchId)
    .order('ordering')

  if (error) throw error

  return ((data ?? []) as RawQuestion[]).map(mapQuestion)
}

interface RawCatalog {
  id: string
  domain_slug: string
  status: DomainCatalog['status']
  source: DomainCatalog['source']
}

interface RawAttribute {
  id: string
  catalog_id: string
  slug: string
  label: string
  prompt: string
  tooltip: string
  answer_type: DomainAttribute['answerType']
  options: GateOption[]
  keywords: string[]
  priority: number
  ordering: number
  target_kind: GateTarget['kind']
  target_field: string
  target_value_type: GateTarget['valueType']
}

function mapAttribute(row: RawAttribute): DomainAttribute {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    prompt: row.prompt,
    tooltip: row.tooltip,
    answerType: row.answer_type,
    options: Array.isArray(row.options) ? row.options : [],
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    priority: row.priority,
    ordering: row.ordering,
    target: {
      kind: row.target_kind,
      field: row.target_field,
      valueType: row.target_value_type,
    },
  }
}

export interface DomainCatalogData {
  catalog: DomainCatalog | null
  attributes: DomainAttribute[]
  coreAttributes: DomainAttribute[]
}

export async function fetchCatalog(domainSlug: string): Promise<DomainCatalogData> {
  const { data: catalogRows, error: catalogError } = await supabase
    .from('domain_catalogs')
    .select('id, domain_slug, status, source')
    .in('domain_slug', [domainSlug, CORE_CATALOG_SLUG])

  if (catalogError) throw catalogError

  const rawCatalogs = (catalogRows ?? []) as RawCatalog[]
  const domainCatalog =
    rawCatalogs.find((row) => row.domain_slug === domainSlug) ?? null
  const coreCatalog = rawCatalogs.find((row) => row.domain_slug === CORE_CATALOG_SLUG) ?? null
  const mapCatalog = (row: RawCatalog): DomainCatalog => ({
    id: row.id,
    domainSlug: row.domain_slug,
    status: row.status,
    source: row.source,
  })

  const catalogIds = [domainCatalog?.id, coreCatalog?.id].filter(
    (id): id is string => typeof id === 'string',
  )
  if (catalogIds.length === 0) {
    return { catalog: domainCatalog ? mapCatalog(domainCatalog) : null, attributes: [], coreAttributes: [] }
  }

  const { data: attrRows, error: attrError } = await supabase
    .from('domain_attributes')
    .select(
      'id, catalog_id, slug, label, prompt, tooltip, answer_type, options, keywords, priority, ordering, target_kind, target_field, target_value_type',
    )
    .in('catalog_id', catalogIds)
    .order('priority', { ascending: true })
    .order('ordering', { ascending: true })

  if (attrError) throw attrError

  const attributes = ((attrRows ?? []) as RawAttribute[])
    .filter((row) => row.catalog_id === domainCatalog?.id)
    .map(mapAttribute)
  const coreAttributes = ((attrRows ?? []) as RawAttribute[])
    .filter((row) => row.catalog_id === coreCatalog?.id)
    .map(mapAttribute)

  return {
    catalog: domainCatalog ? mapCatalog(domainCatalog) : null,
    attributes,
    coreAttributes,
  }
}
