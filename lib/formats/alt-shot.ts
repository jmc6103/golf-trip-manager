import type { FormatModule } from './types'

export const altShot: FormatModule = {
  format: 'ALT_SHOT',
  label: 'Alternate Shot / Foursomes',
  description: 'Partners alternate shots on one team ball.',
  handicapAllowance: 1.0,
  defaultScoreMax: 'TRIPLE_BOGEY',
  isMatchPlay: true,
  isTeamFormat: false,
  skipMatchGeneration: false,
  playersPerSide: 2,
  sideScoring: 'SINGLE',
  leaderboardType: 'match-cards',
  pairingConstraints: [{ type: 'no-repeat-opponents' }],
}
