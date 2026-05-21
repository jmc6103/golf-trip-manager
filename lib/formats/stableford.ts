import type { FormatModule } from './types'

export const stableford: FormatModule = {
  format: 'STABLEFORD',
  label: 'Stableford',
  description: 'Players earn points per hole instead of counting total strokes.',
  handicapAllowance: 1.0,
  defaultScoreMax: 'NONE',
  isMatchPlay: false,
  isTeamFormat: true,
  skipMatchGeneration: true,
  playersPerSide: 1,
  sideScoring: 'SINGLE',
  leaderboardType: 'stroke-table',
  pairingConstraints: [],
}
