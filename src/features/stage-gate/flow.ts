import type { GateAnswer, GateQuestion, GateState } from '@/lib/types'

export const MAX_DEPTH = 2

export function nextBranch(
  state: GateState,
  question: GateQuestion,
  answer: GateAnswer,
): GateState {
  const nextAnswers = { ...state.answers, [question.id]: answer }
  const answeringBranch =
    typeof answer === 'string' && answer.length > 0 ? answer : question.branchId
  const currentBranch = state.branchPath.at(-1)
  const canDescend = state.branchPath.length < MAX_DEPTH
  const shouldAppend = canDescend && answeringBranch !== currentBranch

  return {
    ...state,
    answers: nextAnswers,
    branchPath: shouldAppend ? [...state.branchPath, answeringBranch] : state.branchPath,
  }
}

export function isAtMaxDepth(state: GateState): boolean {
  return state.branchPath.length >= MAX_DEPTH
}

export function isComplete(state: GateState): boolean {
  return isAtMaxDepth(state) && Object.keys(state.answers).length > 0
}
