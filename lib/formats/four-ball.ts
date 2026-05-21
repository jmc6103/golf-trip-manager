import type { FormatModule } from './types'

export const fourBall: FormatModule = {
  format: 'FOUR_BALL',
  label: '2v2 Best Ball / Four-Ball',
  description: 'Each player plays their ball. Side uses the better net score on each hole.',
  handicapAllowance: 0.9,
  defaultScoreMax: 'TRIPLE_BOGEY',
  isMatchPlay: true,
  isTeamFormat: false,
  skipMatchGeneration: false,
  playersPerSide: 2,
  sideScoring: 'BEST_SIDE',
  leaderboardType: 'match-cards',
  pairingConstraints: [{ type: 'no-repeat-opponents' }],
}
