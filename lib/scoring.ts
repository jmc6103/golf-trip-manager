export type HoleForScoring = {
  holeNumber: number
  par: number
  strokeIndex: number
}

export type PlayerForScoring = {
  id: string
  name: string
  handicap: number
}

export type ScoreForScoring = {
  playerId: string
  holeNumber: number
  gross: number
}

export type MatchHoleStatus = {
  holeNumber: number
  completed: boolean
  result: 1 | 2 | 'HALVED' | null
  sideOneNet: number | null
  sideTwoNet: number | null
  sideOneUpAfter: number | null
}

export type MatchStatus = {
  label: string
  completedHoles: number
  holesRemaining: number
  sideOneUp: number
  result: 1 | 2 | 'HALVED' | null
  points: { sideOne: number; sideTwo: number }
}

export function maxScoreForHole(par: number, scoreMax: string) {
  if (scoreMax === 'DOUBLE_BOGEY') return par + 2
  if (scoreMax === 'TRIPLE_BOGEY') return par + 3
  if (scoreMax === 'NET_DOUBLE_BOGEY') return par + 3
  return 20
}

export function allowanceForFormat(format: string) {
  if (format === 'FOUR_BALL') return 0.9
  if (format === 'STROKE_BLIND') return 0.95
  return 1
}

export function getStrokeHoles(strokeDiff: number, holes: HoleForScoring[]) {
  if (strokeDiff <= 0) return []
  const sorted = [...holes].sort((a, b) => a.strokeIndex - b.strokeIndex)
  const result: number[] = []
  let remaining = Math.floor(strokeDiff)

  while (remaining > 0) {
    for (const hole of sorted) {
      if (remaining <= 0) break
      result.push(hole.holeNumber)
      remaining--
    }
  }

  return result
}

export function strokeCountForHole(strokeHoles: number[], holeNumber: number) {
  return strokeHoles.filter((number) => number === holeNumber).length
}

export function getNetScore(gross: number | undefined, strokeHoles: number[], holeNumber: number) {
  if (gross == null) return undefined
  return gross - strokeCountForHole(strokeHoles, holeNumber)
}

export function buildScoreMap(scores: ScoreForScoring[]) {
  const map: Record<string, Record<number, number>> = {}
  for (const score of scores) {
    map[score.playerId] ??= {}
    map[score.playerId][score.holeNumber] = score.gross
  }
  return map
}

export function getMatchStrokeMap(sides: PlayerForScoring[][], holes: HoleForScoring[], format: string) {
  const allPlayers = sides.flat()
  if (!allPlayers.length) return {}

  const lowHandicap = Math.min(...allPlayers.map((player) => player.handicap))
  const allowance = allowanceForFormat(format)

  return Object.fromEntries(
    allPlayers.map((player) => [
      player.id,
      getStrokeHoles(Math.round(Math.max(player.handicap - lowHandicap, 0) * allowance), holes),
    ])
  ) as Record<string, number[]>
}

export function calculateNetTotal(scores: Record<number, number | undefined>, strokeHoles: number[]) {
  return Object.entries(scores).reduce((sum, [holeNumber, gross]) => {
    if (gross == null) return sum
    return sum + getNetScore(gross, strokeHoles, Number(holeNumber))!
  }, 0)
}

export function calculateMatchHoleStatuses(params: {
  holes: HoleForScoring[]
  sideOnePlayers: PlayerForScoring[]
  sideTwoPlayers: PlayerForScoring[]
  scores: ScoreForScoring[]
  format: string
}) {
  const scoreMap = buildScoreMap(params.scores)
  const strokeMap = getMatchStrokeMap([params.sideOnePlayers, params.sideTwoPlayers], params.holes, params.format)
  const sideScoring = params.format === 'FOUR_BALL' || params.format === 'SCRAMBLE' || params.format === 'SHAMBLE' ? 'BEST_SIDE' : 'SINGLES'
  let sideOneUp = 0

  return [...params.holes].sort((a, b) => a.holeNumber - b.holeNumber).map((hole): MatchHoleStatus => {
    const sideOneNets = params.sideOnePlayers
      .map((player) => getNetScore(scoreMap[player.id]?.[hole.holeNumber], strokeMap[player.id] ?? [], hole.holeNumber))
      .filter((score): score is number => score != null)
    const sideTwoNets = params.sideTwoPlayers
      .map((player) => getNetScore(scoreMap[player.id]?.[hole.holeNumber], strokeMap[player.id] ?? [], hole.holeNumber))
      .filter((score): score is number => score != null)

    const sideOneComplete = sideScoring === 'BEST_SIDE' ? sideOneNets.length > 0 : sideOneNets.length >= params.sideOnePlayers.length
    const sideTwoComplete = sideScoring === 'BEST_SIDE' ? sideTwoNets.length > 0 : sideTwoNets.length >= params.sideTwoPlayers.length
    const sideOneNet = sideOneNets.length ? Math.min(...sideOneNets) : null
    const sideTwoNet = sideTwoNets.length ? Math.min(...sideTwoNets) : null

    if (!sideOneComplete || !sideTwoComplete || sideOneNet == null || sideTwoNet == null) {
      return { holeNumber: hole.holeNumber, completed: false, result: null, sideOneNet, sideTwoNet, sideOneUpAfter: null }
    }

    const result = sideOneNet < sideTwoNet ? 1 : sideTwoNet < sideOneNet ? 2 : 'HALVED'
    if (result === 1) sideOneUp++
    if (result === 2) sideOneUp--

    return { holeNumber: hole.holeNumber, completed: true, result, sideOneNet, sideTwoNet, sideOneUpAfter: sideOneUp }
  })
}

export function buildMatchStatus(holes: MatchHoleStatus[], sideOneLabel = 'Side 1', sideTwoLabel = 'Side 2'): MatchStatus {
  const completed = holes.filter((hole) => hole.completed)

  for (let index = 0; index < completed.length; index++) {
    const completedHoles = index + 1
    const sideOneUp = completed[index].sideOneUpAfter ?? 0
    const holesRemaining = Math.max(18 - completedHoles, 0)
    if (Math.abs(sideOneUp) > holesRemaining) {
      return buildStatus(sideOneUp, completedHoles, sideOneLabel, sideTwoLabel)
    }
  }

  return buildStatus(completed.at(-1)?.sideOneUpAfter ?? 0, completed.length, sideOneLabel, sideTwoLabel)
}

function buildStatus(sideOneUp: number, completedHoles: number, sideOneLabel: string, sideTwoLabel: string): MatchStatus {
  const holesRemaining = Math.max(18 - completedHoles, 0)
  const result = getMatchResult(sideOneUp, completedHoles, holesRemaining)
  const status: MatchStatus = {
    label: getMatchLabel(sideOneUp, completedHoles, holesRemaining, sideOneLabel, sideTwoLabel),
    completedHoles,
    holesRemaining,
    sideOneUp,
    result,
    points: { sideOne: 0, sideTwo: 0 },
  }

  status.points = pointsFromStatus(status)
  return status
}

function getMatchLabel(sideOneUp: number, completedHoles: number, holesRemaining: number, sideOneLabel: string, sideTwoLabel: string) {
  if (completedHoles === 0) return 'No holes completed'
  if (Math.abs(sideOneUp) > holesRemaining) {
    const winner = sideOneUp > 0 ? sideOneLabel : sideTwoLabel
    return `${winner} wins ${Math.abs(sideOneUp)} & ${holesRemaining}`
  }
  if (completedHoles === 18) {
    if (sideOneUp === 0) return 'Match halved'
    return sideOneUp > 0 ? `${sideOneLabel} wins by ${sideOneUp}` : `${sideTwoLabel} wins by ${Math.abs(sideOneUp)}`
  }
  if (sideOneUp === 0) return `All Square thru ${completedHoles}`
  return sideOneUp > 0 ? `${sideOneLabel} ${sideOneUp} Up thru ${completedHoles}` : `${sideTwoLabel} ${Math.abs(sideOneUp)} Up thru ${completedHoles}`
}

function getMatchResult(sideOneUp: number, completedHoles: number, holesRemaining: number) {
  if (completedHoles === 0) return null
  if (Math.abs(sideOneUp) > holesRemaining) return sideOneUp > 0 ? 1 : 2
  if (completedHoles === 18) return sideOneUp === 0 ? 'HALVED' : sideOneUp > 0 ? 1 : 2
  return null
}

function pointsFromStatus(status: Omit<MatchStatus, 'points'>) {
  if (status.result === 1) return { sideOne: 1, sideTwo: 0 }
  if (status.result === 2) return { sideOne: 0, sideTwo: 1 }
  if (status.result === 'HALVED') return { sideOne: 0.5, sideTwo: 0.5 }
  if (status.completedHoles === 0 || status.sideOneUp === 0) return { sideOne: 0.5, sideTwo: 0.5 }
  return status.sideOneUp > 0 ? { sideOne: 1, sideTwo: 0 } : { sideOne: 0, sideTwo: 1 }
}
