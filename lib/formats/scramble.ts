import type { FormatModule } from './types'

export const scramble: FormatModule = {
  format: 'SCRAMBLE',
  label: 'Scramble',
  description: 'Team chooses the best shot and everyone plays from there.',
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
