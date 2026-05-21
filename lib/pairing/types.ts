export type PairingPlayer = {
  id: string
  handicap: number
}

export type MatchPairing = {
  sideOne: PairingPlayer[]
  sideTwo: PairingPlayer[]
}

/** Accumulated opponent exposure across all rounds generated so far in one pass */
export type MatchHistory = {
  /** playerId → set of playerIds they have been matched AGAINST in prior rounds */
  opponents: Map<string, Set<string>>
}

export interface PairingStrategy {
  generatePairings(params: {
    sideOnePlayers: PairingPlayer[]
    sideTwoPlayers: PairingPlayer[]
    playersPerSide: 1 | 2
    history: MatchHistory
  }): MatchPairing[]
}

export function emptyHistory(): MatchHistory {
  return { opponents: new Map() }
}

export function recordPairings(history: MatchHistory, pairings: MatchPairing[]) {
  for (const pairing of pairings) {
    for (const p1 of pairing.sideOne) {
      for (const p2 of pairing.sideTwo) {
        addOpponent(history, p1.id, p2.id)
        addOpponent(history, p2.id, p1.id)
      }
    }
  }
}

function addOpponent(history: MatchHistory, a: string, b: string) {
  if (!history.opponents.has(a)) history.opponents.set(a, new Set())
  history.opponents.get(a)!.add(b)
}
