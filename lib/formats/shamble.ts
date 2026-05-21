import type { FormatModule } from './types'

export const shamble: FormatModule = {
  format: 'SHAMBLE',
  label: 'Shamble',
  description: 'Team picks the best drive, then each player finishes their own ball.',
  handicapAllowance: 1.0,
  defaultScoreMax: 'DOUBLE_BOGEY',
  isMatchPlay: true,
  isTeamFormat: true,
  skipMatchGeneration: false,
  playersPerSide: 2,
  sideScoring: 'BEST_SIDE',
  leaderboardType: 'match-cards',
  pairingConstraints: [],
}
