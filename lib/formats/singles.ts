import type { FormatModule } from './types'

export const singles: FormatModule = {
  format: 'SINGLES',
  label: 'Singles Match Play',
  description: 'One player vs one player, hole by hole.',
  handicapAllowance: 1.0,
  defaultScoreMax: 'TRIPLE_BOGEY',
  isMatchPlay: true,
  isTeamFormat: false,
  skipMatchGeneration: false,
  playersPerSide: 1,
  sideScoring: 'SINGLE',
  leaderboardType: 'match-cards',
  pairingConstraints: [{ type: 'no-repeat-opponents' }],
}
