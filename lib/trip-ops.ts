import type { RoundFormat, TeamColor } from '@prisma/client'
import { getDb } from './db'
import { getStrokeHoles, maxScoreForHole } from './scoring'
import { getFormat } from './formats'
import { getStrategy, emptyHistory, recordPairings, type MatchPairing, type PairingPlayer } from './pairing'

type PlayerSeed = {
  id: string
  handicap: number | null
}

const defaultTeamNames = [
  ['Blue', 'RED' as TeamColor],
  ['Red', 'BLUE' as TeamColor],
]

export function buildDefaultHoles() {
  return [
    { holeNumber: 1, par: 4, strokeIndex: 7 },
    { holeNumber: 2, par: 5, strokeIndex: 1 },
    { holeNumber: 3, par: 3, strokeIndex: 17 },
    { holeNumber: 4, par: 4, strokeIndex: 3 },
    { holeNumber: 5, par: 4, strokeIndex: 11 },
    { holeNumber: 6, par: 4, strokeIndex: 5 },
    { holeNumber: 7, par: 3, strokeIndex: 15 },
    { holeNumber: 8, par: 4, strokeIndex: 9 },
    { holeNumber: 9, par: 4, strokeIndex: 13 },
    { holeNumber: 10, par: 5, strokeIndex: 6 },
    { holeNumber: 11, par: 4, strokeIndex: 8 },
    { holeNumber: 12, par: 3, strokeIndex: 16 },
    { holeNumber: 13, par: 4, strokeIndex: 2 },
    { holeNumber: 14, par: 4, strokeIndex: 10 },
    { holeNumber: 15, par: 3, strokeIndex: 18 },
    { holeNumber: 16, par: 4, strokeIndex: 4 },
    { holeNumber: 17, par: 5, strokeIndex: 12 },
    { holeNumber: 18, par: 4, strokeIndex: 14 },
  ]
}

export function isTeamFormat(format: RoundFormat | string) {
  return getFormat(format).isTeamFormat
}

export function isMatchPlayFormat(format: RoundFormat | string) {
  return getFormat(format).isMatchPlay
}

export async function ensureCourseHoles(tripId: string) {
  const db = getDb()
  const courses = await db.course.findMany({ where: { tripId }, include: { holes: true } })
  const holes = buildDefaultHoles()

  await Promise.all(
    courses.map((course) => {
      if (course.holes.length) return Promise.resolve()
      return db.course.update({
        where: { id: course.id },
        data: {
          totalPar: holes.reduce((sum, hole) => sum + hole.par, 0),
          holes: { createMany: { data: holes } },
        },
      })
    })
  )
}

export async function generateTeamsForTrip(slug: string) {
  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug }, include: { players: true, rounds: true } })
  if (!trip) throw new Error('Trip not found.')
  if (trip.players.length < 2) throw new Error('At least two players are needed to create teams.')

  await db.teamPlayer.deleteMany({ where: { team: { tripId: trip.id } } })
  await db.team.deleteMany({ where: { tripId: trip.id } })

  const scrambleOnly = trip.rounds.length > 0 && trip.rounds.every((round) => isTeamFormat(round.format))
  const teamCount = scrambleOnly ? Math.max(2, Math.ceil(trip.players.length / 4)) : 2
  const teams = await Promise.all(
    Array.from({ length: teamCount }, (_, index) =>
      db.team.create({
        data: {
          tripId: trip.id,
          name: scrambleOnly ? `Team ${index + 1}` : index === 0 ? 'Blue' : 'Red',
          color: scrambleOnly ? null : index === 0 ? 'BLUE' : 'RED',
          seed: index + 1,
        },
      })
    )
  )

  const assignments = trip.teamMethod === 'RANDOM' ? shuffle(trip.players) : balancePlayers(trip.players)
  await Promise.all(
    assignments.map((player, index) =>
      db.teamPlayer.create({
        data: {
          teamId: teams[index % teams.length].id,
          playerId: player.id,
          isCaptain: index < teams.length,
        },
      })
    )
  )

  await db.trip.update({ where: { id: trip.id }, data: { status: 'TEAMS_READY' } })
  return generateMatchesForTrip(slug)
}

export async function generateMatchesForTrip(slug: string) {
  const db = getDb()
  const trip = await db.trip.findUnique({
    where: { slug },
    include: {
      rounds: { orderBy: { roundNumber: 'asc' } },
      teams: { orderBy: [{ seed: 'asc' }, { name: 'asc' }], include: { players: { include: { player: true } } } },
    },
  })
  if (!trip) throw new Error('Trip not found.')
  if (trip.teams.length < 2) throw new Error('Create teams before generating matches.')

  await db.holeScore.deleteMany({ where: { tripId: trip.id } })
  await db.match.deleteMany({ where: { tripId: trip.id } })

  const history = emptyHistory()
  const strategy = getStrategy(trip.pairingMethod)

  for (const round of trip.rounds) {
    const fmt = getFormat(round.format)
    if (fmt.skipMatchGeneration) continue
    if (fmt.isTeamFormat) {
      await createTeamRoundMatches(trip.id, round.id, round.format, trip.teams)
    } else {
      const sideOnePlayers: PairingPlayer[] = trip.teams[0].players.map((e) => ({ id: e.player.id, handicap: e.player.handicap ?? 0 }))
      const sideTwoPlayers: PairingPlayer[] = trip.teams[1].players.map((e) => ({ id: e.player.id, handicap: e.player.handicap ?? 0 }))
      const pairings = strategy.generatePairings({ sideOnePlayers, sideTwoPlayers, playersPerSide: fmt.playersPerSide, history })
      await createMatchesFromPairings(trip.id, round.id, trip.teams[0], trip.teams[1], pairings)
      recordPairings(history, pairings)
    }
  }

  return db.trip.update({ where: { id: trip.id }, data: { status: 'TEAMS_READY' } })
}

export async function startRound(slug: string, roundId: string) {
  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug }, select: { id: true } })
  if (!trip) throw new Error('Trip not found.')

  await db.$transaction([
    db.round.updateMany({ where: { tripId: trip.id, status: 'LIVE' }, data: { status: 'NOT_STARTED' } }),
    db.round.update({ where: { id: roundId }, data: { status: 'LIVE', startedAt: new Date() } }),
    db.trip.update({ where: { id: trip.id }, data: { status: 'LIVE' } }),
    db.notificationEvent.create({ data: { tripId: trip.id, type: 'ROUND_STARTED', payload: { roundId } } }),
  ])
}

export async function finalizeRound(slug: string, roundId: string) {
  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug }, select: { id: true } })
  if (!trip) throw new Error('Trip not found.')
  await finalizeRoundResults(trip.id, roundId)
}

export async function voidMatch(slug: string, matchId: string, reason: string) {
  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug }, select: { id: true } })
  if (!trip) throw new Error('Trip not found.')
  const match = await db.match.findFirst({ where: { id: matchId, tripId: trip.id }, select: { id: true, roundId: true, matchNumber: true } })
  if (!match) throw new Error('Match not found.')

  await db.$transaction([
    db.match.update({ where: { id: match.id }, data: { voidedAt: new Date(), voidReason: reason || 'Voided by admin' } }),
    db.adminAction.create({ data: { tripId: trip.id, action: 'void-match', payload: { matchId: match.id, roundId: match.roundId, matchNumber: match.matchNumber, reason } } }),
  ])
}

export async function overrideScore(slug: string, params: { playerId: string; roundId: string; holeNumber: number; gross: number; reason: string }) {
  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug }, select: { id: true } })
  if (!trip) throw new Error('Trip not found.')
  const round = await db.round.findFirst({
    where: { id: params.roundId, tripId: trip.id },
    include: { course: { include: { holes: true } }, matches: { include: { sides: { include: { players: true } } } } },
  })
  if (!round) throw new Error('Round not found.')
  const hole = round.course?.holes.find((item) => item.holeNumber === params.holeNumber)
  if (!hole) throw new Error('Hole not found.')
  const oldScore = await db.holeScore.findUnique({
    where: { roundId_playerId_holeNumber: { roundId: params.roundId, playerId: params.playerId, holeNumber: params.holeNumber } },
    select: { gross: true },
  })
  const match = round.matches.find((item) => item.sides.some((side) => side.players.some((entry) => entry.playerId === params.playerId)))

  await db.$transaction([
    db.holeScore.upsert({
      where: { roundId_playerId_holeNumber: { roundId: params.roundId, playerId: params.playerId, holeNumber: params.holeNumber } },
      create: {
        tripId: trip.id,
        roundId: params.roundId,
        matchId: match?.id ?? null,
        holeId: hole.id,
        playerId: params.playerId,
        holeNumber: params.holeNumber,
        gross: params.gross,
        overriddenByAdminAt: new Date(),
      },
      update: { gross: params.gross, matchId: match?.id ?? null, holeId: hole.id, overriddenByAdminAt: new Date() },
    }),
    db.adminAction.create({
      data: {
        tripId: trip.id,
        action: 'override-score',
        payload: { playerId: params.playerId, roundId: params.roundId, holeNumber: params.holeNumber, oldGross: oldScore?.gross ?? null, newGross: params.gross, reason: params.reason },
      },
    }),
  ])
}

export async function forceFinalizeRound(slug: string, roundId: string) {
  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug }, include: { players: true } })
  if (!trip) throw new Error('Trip not found.')
  const round = await db.round.findFirst({
    where: { id: roundId, tripId: trip.id },
    include: {
      course: { include: { holes: true } },
      matches: { include: { sides: { include: { players: true } } } },
      scores: true,
    },
  })
  if (!round?.course) throw new Error('Round course not found.')

  const playerIds = new Set(round.matches.flatMap((match) => match.sides.flatMap((side) => side.players.map((entry) => entry.playerId))))
  if (!playerIds.size) trip.players.forEach((player) => playerIds.add(player.id))
  const existing = new Set(round.scores.map((score) => `${score.playerId}:${score.holeNumber}`))
  const data = [...playerIds].flatMap((playerId) =>
    round.course!.holes
      .filter((hole) => !existing.has(`${playerId}:${hole.holeNumber}`))
      .map((hole) => ({
        tripId: trip.id,
        roundId: round.id,
        matchId: round.matches.find((match) => match.sides.some((side) => side.players.some((entry) => entry.playerId === playerId)))?.id ?? null,
        holeId: hole.id,
        playerId,
        holeNumber: hole.holeNumber,
        gross: maxScoreForHole(hole.par, trip.scoreMax),
        overriddenByAdminAt: new Date(),
      }))
  )

  await db.$transaction([
    ...(data.length ? [db.holeScore.createMany({ data, skipDuplicates: true })] : []),
    db.adminAction.create({ data: { tripId: trip.id, action: 'force-finalize', payload: { roundId: round.id, insertedScores: data.length } } }),
  ])
  await finalizeRoundResults(trip.id, round.id, true)
}

export async function emergencyWipe(slug: string) {
  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug }, select: { id: true } })
  if (!trip) throw new Error('Trip not found.')
  await db.$transaction([
    db.holeScore.deleteMany({ where: { tripId: trip.id } }),
    db.round.updateMany({ where: { tripId: trip.id }, data: { status: 'NOT_STARTED', startedAt: null, finalizedAt: null } }),
    db.adminAction.create({ data: { tripId: trip.id, action: 'emergency-wipe', payload: { scope: 'scores-and-round-status' } } }),
  ])
}

export async function adjustHandicap(slug: string, playerId: string, newValue: number, reason: string) {
  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug }, select: { id: true } })
  if (!trip) throw new Error('Trip not found.')
  const player = await db.player.findFirst({ where: { id: playerId, tripId: trip.id }, select: { id: true, handicap: true } })
  if (!player) throw new Error('Player not found.')
  const oldValue = player.handicap ?? 0

  await db.$transaction([
    db.player.update({ where: { id: player.id }, data: { handicap: newValue } }),
    db.handicapAdjustment.create({ data: { tripId: trip.id, playerId: player.id, oldValue, newValue, reason } }),
    db.adminAction.create({ data: { tripId: trip.id, action: 'adjust-handicap', payload: { playerId: player.id, oldValue, newValue, reason } } }),
  ])
}

export async function generateFoursomesForTrip(slug: string) {
  const db = getDb()
  const trip = await db.trip.findUnique({
    where: { slug },
    include: {
      players: { include: { teamMemberships: { include: { team: true } } } },
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: {
          matches: {
            orderBy: { matchNumber: 'asc' },
            include: { sides: { orderBy: { sideIndex: 'asc' }, include: { players: { orderBy: { position: 'asc' } } } } },
          },
        },
      },
    },
  })
  if (!trip) throw new Error('Trip not found.')

  const writes = trip.rounds.flatMap((round) => {
    const groups = buildFoursomeGroupsForRound(round, trip.players)
    return groups.map((playerIds, index) =>
      db.foursome.create({
        data: {
          tripId: trip.id,
          roundId: round.id,
          groupNumber: index + 1,
          player1Id: playerIds[0] ?? null,
          player2Id: playerIds[1] ?? null,
          player3Id: playerIds[2] ?? null,
          player4Id: playerIds[3] ?? null,
        },
      })
    )
  })

  await db.$transaction([
    db.foursome.deleteMany({ where: { tripId: trip.id } }),
    ...writes,
    db.adminAction.create({ data: { tripId: trip.id, action: 'generate-foursomes', payload: { roundCount: trip.rounds.length, groupCount: writes.length } } }),
  ])
}

export async function updateFoursomeScorekeeper(slug: string, playerId: string, roundId: string, scorekeeperPlayerId: string | null) {
  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug }, select: { id: true } })
  if (!trip) throw new Error('Trip not found.')
  const foursome = await db.foursome.findFirst({
    where: {
      tripId: trip.id,
      roundId,
      OR: [{ player1Id: playerId }, { player2Id: playerId }, { player3Id: playerId }, { player4Id: playerId }],
    },
  })
  if (!foursome) throw new Error('No group found for this round.')
  const ids = playerIdsForFoursome(foursome)
  if (scorekeeperPlayerId && !ids.includes(scorekeeperPlayerId)) throw new Error('Scorekeeper must be in the group.')
  await db.foursome.update({ where: { id: foursome.id }, data: { scorekeeperPlayerId } })
}

async function createTeamRoundMatches(
  tripId: string,
  roundId: string,
  format: RoundFormat,
  teams: Array<{ id: string; name: string; players: Array<{ playerId: string; player: { id: string } }> }>
) {
  const db = getDb()
  const match = await db.match.create({ data: { tripId, roundId, matchNumber: 1, status: 'SCHEDULED' } })
  await Promise.all(
    teams.map((team, index) =>
      db.matchSide.create({
        data: {
          matchId: match.id,
          sideIndex: index + 1,
          teamId: team.id,
          label: team.name,
          players: { createMany: { data: team.players.map((entry, playerIndex) => ({ playerId: entry.player.id, position: playerIndex + 1 })) } },
        },
      })
    )
  )
}

async function createMatchesFromPairings(
  tripId: string,
  roundId: string,
  teamOne: { id: string; name: string },
  teamTwo: { id: string; name: string },
  pairings: MatchPairing[],
) {
  const db = getDb()
  for (let index = 0; index < pairings.length; index++) {
    const pairing = pairings[index]
    const match = await db.match.create({ data: { tripId, roundId, matchNumber: index + 1, status: 'SCHEDULED' } })
    await db.matchSide.create({
      data: {
        matchId: match.id,
        sideIndex: 1,
        teamId: teamOne.id,
        label: teamOne.name,
        players: { createMany: { data: pairing.sideOne.map((p, i) => ({ playerId: p.id, position: i + 1 })) } },
      },
    })
    await db.matchSide.create({
      data: {
        matchId: match.id,
        sideIndex: 2,
        teamId: teamTwo.id,
        label: teamTwo.name,
        players: { createMany: { data: pairing.sideTwo.map((p, i) => ({ playerId: p.id, position: i + 1 })) } },
      },
    })
  }
}

async function finalizeRoundResults(tripId: string, roundId: string, forced = false) {
  const db = getDb()
  const round = await db.round.findFirst({
    where: { id: roundId, tripId },
    include: {
      course: { include: { holes: true } },
      scores: true,
      matches: {
        include: {
          sides: { orderBy: { sideIndex: 'asc' }, include: { players: { include: { player: true }, orderBy: { position: 'asc' } } } },
        },
      },
    },
  })
  if (!round) throw new Error('Round not found.')

  const sideUpdates = round.format === 'STROKE_BLIND' && round.course
    ? buildStrokeBlindSideUpdates(round)
    : []

  const allFinalAfter = await db.round.count({ where: { tripId, id: { not: roundId }, status: { not: 'FINAL' } } })
  await db.$transaction([
    ...sideUpdates.map((update) => db.matchSide.update({ where: { id: update.sideId }, data: { points: update.points } })),
    ...round.matches.map((match) =>
      db.match.update({
        where: { id: match.id },
        data: { status: 'FINAL', ...(match.voidedAt ? { result: null } : {}), finalizedAt: new Date() },
      })
    ),
    db.round.update({ where: { id: roundId }, data: { status: 'FINAL', finalizedAt: new Date() } }),
    ...(allFinalAfter === 0 ? [db.trip.update({ where: { id: tripId }, data: { status: 'COMPLETE' } })] : []),
    db.notificationEvent.create({ data: { tripId, type: 'ROUND_FINAL', payload: { roundId, forced } } }),
  ])
}

function buildStrokeBlindSideUpdates(round: {
  scores: Array<{ playerId: string; holeNumber: number; gross: number }>
  course: { holes: Array<{ holeNumber: number; par: number; strokeIndex: number }> } | null
  matches: Array<{
    voidedAt: Date | null
    sides: Array<{ id: string; players: Array<{ player: { id: string; handicap: number | null } }> }>
  }>
}) {
  const holes = round.course?.holes ?? []
  const scoreMap = new Map<string, Record<number, number>>()
  for (const score of round.scores) {
    scoreMap.set(score.playerId, { ...(scoreMap.get(score.playerId) ?? {}), [score.holeNumber]: score.gross })
  }

  return round.matches.flatMap((match) => {
    const sideOne = match.sides[0]
    const sideTwo = match.sides[1]
    const playerOne = sideOne?.players[0]?.player
    const playerTwo = sideTwo?.players[0]?.player
    if (!sideOne || !sideTwo || !playerOne || !playerTwo || match.voidedAt) {
      return [
        ...(sideOne ? [{ sideId: sideOne.id, points: 0 }] : []),
        ...(sideTwo ? [{ sideId: sideTwo.id, points: 0 }] : []),
      ]
    }
    const oneNet = strokePlayNet(scoreMap.get(playerOne.id) ?? {}, playerOne.handicap ?? 0, holes)
    const twoNet = strokePlayNet(scoreMap.get(playerTwo.id) ?? {}, playerTwo.handicap ?? 0, holes)
    if (oneNet == null || twoNet == null) return [{ sideId: sideOne.id, points: 0 }, { sideId: sideTwo.id, points: 0 }]
    if (oneNet < twoNet) return [{ sideId: sideOne.id, points: 1 }, { sideId: sideTwo.id, points: 0 }]
    if (twoNet < oneNet) return [{ sideId: sideOne.id, points: 0 }, { sideId: sideTwo.id, points: 1 }]
    return [{ sideId: sideOne.id, points: 0.5 }, { sideId: sideTwo.id, points: 0.5 }]
  })
}

function strokePlayNet(scores: Record<number, number>, handicap: number, holes: Array<{ holeNumber: number; par: number; strokeIndex: number }>) {
  if (Object.keys(scores).length < holes.length) return null
  const strokeHoles = getStrokeHoles(Math.round(handicap * 0.95), holes)
  return Object.entries(scores).reduce((sum, [holeNumber, gross]) => {
    const strokes = strokeHoles.filter((number) => number === Number(holeNumber)).length
    return sum + gross - strokes
  }, 0)
}

function buildFoursomeGroupsForRound(
  round: {
    format: RoundFormat
    matches: Array<{ sides: Array<{ players: Array<{ playerId: string }> }> }>
  },
  players: Array<{ id: string; handicap: number | null; teamMemberships: Array<{ team: { seed: number | null } }> }>
) {
  if (round.matches.length) {
    const matchGroups = round.matches
      .map((match) => match.sides.flatMap((side) => side.players.map((entry) => entry.playerId)))
      .filter((ids) => ids.length > 0)
    if (round.format === 'SINGLES' || round.format === 'STROKE_BLIND') {
      const groups: string[][] = []
      for (let index = 0; index < matchGroups.length; index += 2) {
        groups.push([...matchGroups[index], ...(matchGroups[index + 1] ?? [])].slice(0, 4))
      }
      return groups
    }
    return matchGroups.map((ids) => ids.slice(0, 4))
  }

  const sorted = [...players].sort((a, b) => {
    const seedGap = (a.teamMemberships[0]?.team.seed ?? 0) - (b.teamMemberships[0]?.team.seed ?? 0)
    return seedGap || (a.handicap ?? 0) - (b.handicap ?? 0)
  })
  const groups: string[][] = []
  for (let index = 0; index < sorted.length; index += 4) groups.push(sorted.slice(index, index + 4).map((player) => player.id))
  return groups
}

function playerIdsForFoursome(foursome: { player1Id: string | null; player2Id: string | null; player3Id: string | null; player4Id: string | null }) {
  return [foursome.player1Id, foursome.player2Id, foursome.player3Id, foursome.player4Id].filter((id): id is string => Boolean(id))
}

function balancePlayers(players: PlayerSeed[]) {
  const sorted = [...players].sort(byHandicap)
  const result: PlayerSeed[] = []
  const left: PlayerSeed[] = []
  const right: PlayerSeed[] = []

  sorted.forEach((player, index) => (index % 2 === 0 ? left : right).push(player))
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    if (left[index]) result.push(left[index])
    if (right[index]) result.push(right[index])
  }

  return result
}

function byHandicap(a: { handicap: number | null }, b: { handicap: number | null }) {
  return (a.handicap ?? 0) - (b.handicap ?? 0)
}

function shuffle<T>(arr: T[]) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
