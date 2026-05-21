const HANDICAP_BANDS = [
  { max: 4.9, label: '0-4' },
  { max: 9.9, label: '5-9' },
  { max: 14.9, label: '10-14' },
  { max: 19.9, label: '15-19' },
  { max: 24.9, label: '20-24' },
  { max: 29.9, label: '25-29' },
  { max: 34.9, label: '30-34' },
  { max: 39.9, label: '35-39' },
] as const

// USGA frequency table: rows = net score delta (-12 to +3), cols = handicap band index (0-7)
// Each cell = expected frequency (1-in-N rounds). Higher = rarer.
const SCORE_FREQUENCY_TABLE: Record<number, number[]> = {
  3:    [1.8,     1.8,     1.9,     2.0,     2.1,     2.1,     2.2,     2.3],
  2:    [2.4,     2.5,     2.5,     2.5,     2.6,     2.7,     2.8,     2.9],
  1:    [3.6,     3.6,     3.6,     3.6,     3.5,     3.5,     3.5,     3.5],
  0:    [5.9,     5.5,     5.3,     5.2,     5.1,     5.0,     5.0,     4.8],
  [-1]: [11.1,    9.7,     8.9,     8.2,     7.7,     7.4,     7.1,     6.6],
  [-2]: [23.0,    18.5,    16.1,    13.8,    12.4,    11.3,    10.5,    9.4],
  [-3]: [53.5,    38.5,    31.2,    24.7,    21.1,    18.0,    16.0,    13.7],
  [-4]: [139.8,   87.1,    64.7,    46.9,    37.3,    29.8,    25.1,    20.4],
  [-5]: [376.5,   210.9,   140.1,   93.3,    68.6,    51.2,    40.4,    31.0],
  [-6]: [986.8,   535.7,   317.4,   191.5,   130.5,   89.9,    66.5,    47.9],
  [-7]: [2247.9,  1282.2,  704.6,   391.4,   251.2,   161.8,   110.5,   74.5],
  [-8]: [6362.8,  3361.9,  1580.6,  743.0,   451.2,   265.7,   170.1,   109.3],
  [-9]: [13861.8, 8202.6,  3609.9,  1362.7,  828.0,   449.0,   264.2,   159.8],
  [-10]:[22831.3, 15812.0, 7186.6,  2204.6,  1431.9,  715.9,   398.0,   226.6],
  [-11]:[32344.3, 28561.4, 13166.4, 3153.5,  2202.2,  1061.6,  559.8,   299.6],
  [-12]:[58219.8, 44968.9, 21133.7, 4085.7,  3157.2,  1476.7,  748.1,   380.5],
}

export type SandbaggerFlag = 'SANDBAGGER' | 'SOUNDS_ABOUT_RIGHT' | 'BUM'

export type USGAOddsResult = {
  odds: number
  probability: number
  row: number
  handicapBand: string
}

export function getHandicapBandIndex(handicap: number): number {
  return HANDICAP_BANDS.findIndex((band) => handicap <= band.max)
}

export function getUSGAOdds(netScoreDelta: number, handicap: number): USGAOddsResult | null {
  const bandIndex = getHandicapBandIndex(handicap)
  if (bandIndex === -1) return null

  const row = Math.max(-12, Math.min(3, Math.round(netScoreDelta)))
  const odds = SCORE_FREQUENCY_TABLE[row]?.[bandIndex]
  if (!odds) return null

  return {
    odds,
    probability: 100 / odds,
    row,
    handicapBand: HANDICAP_BANDS[bandIndex].label,
  }
}

export function getSandbaggerFlag(netScoreDelta: number): SandbaggerFlag {
  if (netScoreDelta <= -3) return 'SANDBAGGER'
  if (netScoreDelta >= 5) return 'BUM'
  return 'SOUNDS_ABOUT_RIGHT'
}

export function getNetDifferential(params: {
  gross: number
  rating: number
  slope: number
  handicap: number
}): number {
  const differential = (113 / params.slope) * (params.gross - params.rating)
  return differential - params.handicap
}
