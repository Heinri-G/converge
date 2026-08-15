import { describe, expect, it } from 'vitest'
import type { GateQuestion, GateState } from '@/lib/types'
import { clampGateState, isAtMaxDepth, isComplete, MAX_DEPTH, nextBranch } from './flow'
import { createFastTrackedState } from './fastTrack'

const question: GateQuestion = {
  id: 'question-1',
  branchId: 'root',
  prompt: 'Where will it live?',
  tooltip: 'Footprint changes the decision.',
  answerType: 'single',
  options: [{ value: 'child', label: 'A child branch' }],
  weight: 1,
  ordering: 0,
}

const initialState: GateState = {
  domainSlug: 'coffee-espresso',
  branchPath: ['root'],
  answers: {},
}

describe('stage gate flow controller', () => {
  it('records the answer and descends into the selected branch', () => {
    const next = nextBranch(initialState, question, 'child')

    expect(next.answers).toEqual({ 'question-1': 'child' })
    expect(next.branchPath).toEqual(['root', 'child'])
    expect(isAtMaxDepth(next)).toBe(true)
    expect(isComplete(next)).toBe(true)
  })

  it('never grows the branch path beyond the depth cap', () => {
    const atMax = nextBranch(initialState, question, 'child')
    const clamped = nextBranch(atMax, { ...question, id: 'question-2' }, 'another')

    expect(clamped.branchPath).toHaveLength(MAX_DEPTH)
    expect(clamped.answers).toEqual({
      'question-1': 'child',
      'question-2': 'another',
    })
  })

  it('does not call an empty state complete', () => {
    expect(isAtMaxDepth(initialState)).toBe(false)
    expect(isComplete(initialState)).toBe(false)
  })

  it('truncates an over-deep resumed state defensively', () => {
    const deepState = { ...initialState, branchPath: ['root', 'one', 'two', 'three'] }

    expect(clampGateState(deepState).branchPath).toEqual(['root', 'one'])
  })

  it('marks fast track without adding another branch level', () => {
    const fastTracked = createFastTrackedState({
      ...initialState,
      branchPath: ['root', 'child'],
    })

    expect(fastTracked.fastTracked).toBe(true)
    expect(fastTracked.branchPath).toEqual(['root', 'child'])
  })
})
