import type { PairingStrategy } from './types'

/** Passthrough strategy — creates match shells sorted by handicap; admin assigns players via PATCH match-side. */
export const manualStrategy: PairingStrategy = {
  generatePairings({ sideOnePlayers, sideTwoPlayers, playersPerSide }) {
    const one = [...sideOnePlayers].sort(byHandicap)
    const two = [...sideTwoPlayers].sort(byHandicap)
    const matchCount = Math.min(Math.floor(one.length / playersPerSide), Math.floor(two.length / playersPerSide))
    return Array.from({ length: matchCount }, (_, i) => ({
      sideOne: one.slice(i * playersPerSide, i * playersPerSide + playersPerSide),
      sideTwo: two.slice(i * playersPerSide, i * playersPerSide + playersPerSide),
    }))
  },
}

function byHandicap(a: { handicap: number }, b: { handicap: number }) {
  return a.handicap - b.handicap
}
