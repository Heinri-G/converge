import { supabase } from '@/lib/supabase'
import type { DomainBranch, GateOption, GateQuestion } from '@/lib/types'

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
    .from('domain_branches')
    .select('domain_slug')
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
