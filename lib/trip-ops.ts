import type { RoundFormat, TeamColor } from '@prisma/client'
import { getDb } from './db'

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
  return ['SCRAMBLE', 'SHAMBLE', 'STABLEFORD'].includes(String(format))
}

export function isMatchPlayFormat(format: RoundFormat | string) {
  return ['FOUR_BALL', 'SINGLES', 'ALT_SHOT', 'SCRAMBLE', 'SHAMBLE'].includes(String(format))
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

  for (const round of trip.rounds) {
    if (round.format === 'STROKE_BLIND' || round.format === 'STABLEFORD') continue
    if (isTeamFormat(round.format)) {
      await createTeamRoundMatches(trip.id, round.id, round.format, trip.teams)
    } else {
      await createTwoTeamMatches(trip.id, round.id, round.format, trip.teams[0], trip.teams[1])
    }
  }

  return db.trip.update({ where: { id: trip.id }, data: { status: 'TEAMS_READY' } })
}

export async function startRound(slug: string, roundId: string) {
  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug }, select: { id: true } })
  if (!trip) throw new Error('Trip not found.')

  await db.round.updateMany({ where: { tripId: trip.id, status: 'LIVE' }, data: { status: 'NOT_STARTED' } })
  await db.round.update({ where: { id: roundId }, data: { status: 'LIVE', startedAt: new Date() } })
  await db.trip.update({ where: { id: trip.id }, data: { status: 'LIVE' } })
}

export async function finalizeRound(slug: string, roundId: string) {
  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug }, select: { id: true } })
  if (!trip) throw new Error('Trip not found.')
  await db.round.update({ where: { id: roundId }, data: { status: 'FINAL', finalizedAt: new Date() } })
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

async function createTwoTeamMatches(
  tripId: string,
  roundId: string,
  format: RoundFormat,
  one: { id: string; name: string; players: Array<{ player: { id: string; handicap: number | null } }> },
  two: { id: string; name: string; players: Array<{ player: { id: string; handicap: number | null } }> }
) {
  const db = getDb()
  const onePlayers = [...one.players].map((entry) => entry.player).sort(byHandicap)
  const twoPlayers = [...two.players].map((entry) => entry.player).sort(byHandicap)
  const size = format === 'FOUR_BALL' || format === 'ALT_SHOT' ? 2 : 1
  const matchCount = Math.min(Math.ceil(onePlayers.length / size), Math.ceil(twoPlayers.length / size))

  for (let index = 0; index < matchCount; index++) {
    const match = await db.match.create({ data: { tripId, roundId, matchNumber: index + 1, status: 'SCHEDULED' } })
    const oneSlice = onePlayers.slice(index * size, index * size + size)
    const twoSlice = twoPlayers.slice(index * size, index * size + size)
    await db.matchSide.create({
      data: {
        matchId: match.id,
        sideIndex: 1,
        teamId: one.id,
        label: one.name,
        players: { createMany: { data: oneSlice.map((player, playerIndex) => ({ playerId: player.id, position: playerIndex + 1 })) } },
      },
    })
    await db.matchSide.create({
      data: {
        matchId: match.id,
        sideIndex: 2,
        teamId: two.id,
        label: two.name,
        players: { createMany: { data: twoSlice.map((player, playerIndex) => ({ playerId: player.id, position: playerIndex + 1 })) } },
      },
    })
  }
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
