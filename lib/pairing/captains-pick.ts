import type { PairingStrategy } from './types'
import { manualStrategy } from './manual'

/**
 * Stub — captain alternates picking opponents for their team members.
 * UI flow (admin picks per captain) not yet implemented; falls back to manual (handicap-sorted shells).
 * TODO: Add admin UI step between "generate teams" and "start round" for captain selection.
 */
export const captainsPickStrategy: PairingStrategy = manualStrategy
