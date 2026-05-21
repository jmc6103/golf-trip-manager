import type { MatchHistory, MatchPairing, PairingPlayer, PairingStrategy } from './types'

export const randomStrategy: PairingStrategy = {
  generatePairings({ sideOnePlayers, sideTwoPlayers, playersPerSide }) {
    return crossMatch(shuffle(sideOnePlayers), shuffle(sideTwoPlayers), playersPerSide)
  },
}

function crossMatch(one: PairingPlayer[], two: PairingPlayer[], size: 1 | 2): MatchPairing[] {
  const matchCount = Math.min(Math.floor(one.length / size), Math.floor(two.length / size))
  const pairings: MatchPairing[] = []
  for (let i = 0; i < matchCount; i++) {
    pairings.push({ sideOne: one.slice(i * size, i * size + size), sideTwo: two.slice(i * size, i * size + size) })
  }
  return pairings
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
