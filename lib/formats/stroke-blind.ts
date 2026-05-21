import type { FormatModule } from './types'

export const strokeBlind: FormatModule = {
  format: 'STROKE_BLIND',
  label: 'Individual Stroke Play + Blind Matches',
  description: 'Players post full rounds, then hidden head-to-head results are revealed.',
  handicapAllowance: 0.95,
  defaultScoreMax: 'TRIPLE_BOGEY',
  isMatchPlay: false,
  isTeamFormat: false,
  skipMatchGeneration: false,
  playersPerSide: 1,
  sideScoring: 'SINGLE',
  leaderboardType: 'stroke-table',
  pairingConstraints: [],
}
