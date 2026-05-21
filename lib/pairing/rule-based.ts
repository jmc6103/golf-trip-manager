import type { MatchHistory, MatchPairing, PairingPlayer, PairingStrategy } from './types'

export const ruleBasedStrategy: PairingStrategy = {
  generatePairings({ sideOnePlayers, sideTwoPlayers, playersPerSide, history }) {
    const one = [...sideOnePlayers].sort(byHandicap)
    const two = [...sideTwoPlayers].sort(byHandicap)

    if (playersPerSide === 1) return pairSingles(one, two, history)

    // FOUR_BALL / ALT_SHOT: pair within each team first, then cross-match pairs
    const onePairs = bestInternalPairing(one)
    const twoPairs = bestInternalPairing(two)
    return pairGroups(onePairs, twoPairs, history)
  },
}

// ─── Singles DFS ────────────────────────────────────────────────────────────

function pairSingles(one: PairingPlayer[], two: PairingPlayer[], history: MatchHistory): MatchPairing[] {
  const best = { score: Infinity, pairings: [] as MatchPairing[] }
  const used = new Set<string>()
  const current: MatchPairing[] = []

  function dfs(index: number, score: number) {
    if (score >= best.score) return
    if (index === one.length) {
      best.score = score
      best.pairings = current.map((p) => ({ sideOne: [...p.sideOne], sideTwo: [...p.sideTwo] }))
      return
    }

    const p1 = one[index]
    const candidates = two
      .filter((p) => !used.has(p.id))
      .sort((a, b) => Math.abs(p1.handicap - a.handicap) - Math.abs(p1.handicap - b.handicap))

    for (const p2 of candidates) {
      const gap = Math.abs(p1.handicap - p2.handicap)
      const isRepeat = history.opponents.get(p1.id)?.has(p2.id) ?? false
      const penalty = gap + (gap > 10 ? (gap - 10) * 100 : 0) + (isRepeat ? 10000 : 0)

      used.add(p2.id)
      current.push({ sideOne: [p1], sideTwo: [p2] })
      dfs(index + 1, score + penalty)
      current.pop()
      used.delete(p2.id)
    }
  }

  dfs(0, 0)
  return best.pairings.length ? best.pairings : fallbackSingles(one, two)
}

// ─── Four-Ball: within-team pairing then cross-match ────────────────────────

type Pair = [PairingPlayer, PairingPlayer]

/** Returns the optimal way to partition `players` into pairs of 2, minimising average gap. */
function bestInternalPairing(players: PairingPlayer[]): Pair[] {
  if (players.length < 2) return []
  const partitions = buildPairPartitions(players)
  let best: Pair[] = partitions[0] ?? []
  let bestScore = Infinity

  for (const partition of partitions) {
    const score = partition.reduce((sum, [a, b]) => sum + Math.abs(a.handicap - b.handicap), 0)
    if (score < bestScore) { bestScore = score; best = partition }
  }

  return best
}

/** Enumerates all ways to partition an array into pairs of 2 (n-1)!! permutations. */
function buildPairPartitions(players: PairingPlayer[]): Pair[][] {
  if (players.length === 0) return [[]]
  if (players.length === 2) return [[[players[0], players[1]]]]

  const [first, ...rest] = players
  const result: Pair[][] = []

  for (let i = 0; i < rest.length; i++) {
    const partner = rest[i]
    const remaining = rest.filter((_, idx) => idx !== i)
    for (const child of buildPairPartitions(remaining)) {
      result.push([[first, partner], ...child])
    }
  }

  return result
}

/** Cross-match pairs from sideOne against pairs from sideTwo using DFS. */
function pairGroups(onePairs: Pair[], twoPairs: Pair[], history: MatchHistory): MatchPairing[] {
  const matchCount = Math.min(onePairs.length, twoPairs.length)
  const oneSlice = onePairs.slice(0, matchCount)
  const twoSlice = twoPairs.slice(0, matchCount)

  const best = { score: Infinity, pairings: [] as MatchPairing[] }
  const used = new Set<number>()
  const current: MatchPairing[] = []

  function dfs(index: number, score: number) {
    if (score >= best.score) return
    if (index === oneSlice.length) {
      best.score = score
      best.pairings = current.map((p) => ({ sideOne: [...p.sideOne], sideTwo: [...p.sideTwo] }))
      return
    }

    const onePair = oneSlice[index]
    const candidates = twoSlice
      .map((pair, idx) => ({ pair, idx }))
      .filter(({ idx }) => !used.has(idx))
      .sort((a, b) => pairMatchCost(onePair, a.pair, history) - pairMatchCost(onePair, b.pair, history))

    for (const { pair: twoPair, idx } of candidates) {
      const cost = pairMatchCost(onePair, twoPair, history)
      used.add(idx)
      current.push({ sideOne: [...onePair], sideTwo: [...twoPair] })
      dfs(index + 1, score + cost)
      current.pop()
      used.delete(idx)
    }
  }

  dfs(0, 0)
  return best.pairings.length ? best.pairings : fallbackGroups(oneSlice, twoSlice)
}

function pairMatchCost(onePair: Pair, twoPair: Pair, history: MatchHistory): number {
  const avgGap = Math.abs(avg(onePair) - avg(twoPair))
  const spreadGap = Math.abs(spread(onePair) - spread(twoPair))
  let repeatPenalty = 0
  for (const p1 of onePair) {
    for (const p2 of twoPair) {
      if (history.opponents.get(p1.id)?.has(p2.id)) repeatPenalty += 10000
    }
  }
  return avgGap * 12 + spreadGap * 3 + repeatPenalty
}

// ─── Fallbacks (shouldn't be reached for normal trip sizes) ─────────────────

function fallbackSingles(one: PairingPlayer[], two: PairingPlayer[]): MatchPairing[] {
  const matchCount = Math.min(one.length, two.length)
  return Array.from({ length: matchCount }, (_, i) => ({ sideOne: [one[i]], sideTwo: [two[i]] }))
}

function fallbackGroups(one: Pair[], two: Pair[]): MatchPairing[] {
  const matchCount = Math.min(one.length, two.length)
  return Array.from({ length: matchCount }, (_, i) => ({ sideOne: [...one[i]], sideTwo: [...two[i]] }))
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function byHandicap(a: PairingPlayer, b: PairingPlayer) {
  return a.handicap - b.handicap
}

function avg(pair: Pair) {
  return (pair[0].handicap + pair[1].handicap) / 2
}

function spread(pair: Pair) {
  return Math.abs(pair[0].handicap - pair[1].handicap)
}
