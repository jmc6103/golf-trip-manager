import type { PairingStrategy } from './types'
import { randomStrategy } from './random'
import { manualStrategy } from './manual'
import { captainsPickStrategy } from './captains-pick'
import { ruleBasedStrategy } from './rule-based'

export type { PairingPlayer, MatchPairing, MatchHistory, PairingStrategy } from './types'
export { emptyHistory, recordPairings } from './types'

const strategyRegistry: Record<string, PairingStrategy> = {
  RULE_BASED: ruleBasedStrategy,
  RANDOM: randomStrategy,
  MANUAL: manualStrategy,
  CAPTAINS_PICK: captainsPickStrategy,
}

export function getStrategy(method: string): PairingStrategy {
  return strategyRegistry[method] ?? randomStrategy
}
