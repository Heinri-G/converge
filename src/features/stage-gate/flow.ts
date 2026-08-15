import type { GateAnswer, GateQuestion, GateState } from '@/lib/types'

export const MAX_DEPTH = 2

export function clampGateState(state: GateState): GateState {
  return {
    ...state,
    branchPath: state.branchPath.slice(0, MAX_DEPTH),
  }
}

export function nextBranch(
  state: GateState,
  question: GateQuestion,
  answer: GateAnswer,
): GateState {
  const safeState = clampGateState(state)
  const nextAnswers = { ...safeState.answers, [question.id]: answer }
  const answeringBranch =
    typeof answer === 'string' && answer.length > 0 ? answer : question.branchId
  const currentBranch = safeState.branchPath.at(-1)
  const canDescend = safeState.branchPath.length < MAX_DEPTH
  const shouldAppend = canDescend && answeringBranch !== currentBranch

  return {
    ...safeState,
    answers: nextAnswers,
    branchPath: shouldAppend ? [...safeState.branchPath, answeringBranch] : safeState.branchPath,
  }
}

export function isAtMaxDepth(state: GateState): boolean {
  return state.branchPath.length >= MAX_DEPTH
}

export function isComplete(state: GateState): boolean {
  return isAtMaxDepth(state) && Object.keys(state.answers).length > 0
}
