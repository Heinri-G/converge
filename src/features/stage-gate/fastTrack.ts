import { clampGateState } from './flow'
import type { GateState } from '@/lib/types'

export function createFastTrackedState(state: GateState): GateState {
  return {
    ...clampGateState(state),
    fastTracked: true,
  }
}
