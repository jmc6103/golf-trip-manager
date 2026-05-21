import type { RoundFormat, ScoreMax } from '@prisma/client'

export type PairingConstraint = { type: 'no-repeat-opponents' }

export type FormatModule = {
  format: RoundFormat
  label: string
  description: string
  /** Fraction applied to handicap differential for stroke allocation (0.0–1.0) */
  handicapAllowance: number
  defaultScoreMax: ScoreMax
  /** True when hole-by-hole match play scoring applies */
  isMatchPlay: boolean
  /** True when a single team-vs-team match covers the whole round (SCRAMBLE/SHAMBLE) */
  isTeamFormat: boolean
  /** True when match generation is skipped entirely (STROKE_BLIND, STABLEFORD) */
  skipMatchGeneration: boolean
  /** Players per side in each individual match — only used when !isTeamFormat */
  playersPerSide: 1 | 2
  /** How to derive a side's score from its players on each hole */
  sideScoring: 'BEST_SIDE' | 'SINGLE'
  /** Which leaderboard layout to render in the team board */
  leaderboardType: 'match-cards' | 'stroke-table'
  pairingConstraints: PairingConstraint[]
}
