import { getDb } from './db'
import { formatLabel, getPlayerFromCookie } from './tenant-data'
import { buildMatchStatus, buildScoreMap, calculateMatchHoleStatuses, calculateNetTotal, getMatchStrokeMap, type PlayerForScoring } from './scoring'
import { ensureCourseHoles, isMatchPlayFormat, isTeamFormat } from './trip-ops'

function byHole(a: { holeNumber: number }, b: { holeNumber: number }) {
  return a.holeNumber - b.holeNumber
}

function byRound(a: { roundNumber: number }, b: { roundNumber: number }) {
  return a.roundNumber - b.roundNumber
}

function playerSummary(player: { id: string; name: string; handicap: number | null }) {
  return { id: player.id, name: player.name, handicap: player.handicap ?? 0 }
}

function sideLabel(side: { label: string | null; team: { name: string } | null }, fallback: string) {
  return side.team?.name ?? side.label ?? fallback
}

export async function getLobbyData(slug: string) {
  const db = getDb()
  const trip = await db.trip.findUnique({
    where: { slug },
    include: {
      players: { orderBy: { registeredAt: 'asc' } },
      teams: { orderBy: [{ seed: 'asc' }, { name: 'asc' }], include: { players: { include: { player: true } } } },
      rounds: { orderBy: { roundNumber: 'asc' } },
    },
  })
  if (!trip) return null

  return {
    trip: {
      slug: trip.slug,
      name: trip.name,
      status: trip.status,
      maxPlayers: trip.maxPlayers,
      teamMethod: trip.teamMethod,
      pairingMethod: trip.pairingMethod,
    },
    count: trip.players.length,
    players: trip.players.map(playerSummary),
    teams: trip.teams.map((team) => ({
      id: team.id,
      name: team.name,
      color: team.color,
      players: team.players.map((entry) => ({ ...playerSummary(entry.player), isCaptain: entry.isCaptain })),
    })),
    rounds: trip.rounds.map((round) => ({
      id: round.id,
      roundNumber: round.roundNumber,
      name: round.name,
      format: round.format,
      formatLabel: formatLabel(round.format),
      status: round.status,
    })),
  }
}

export async function getTeamBoardData(slug: string, roundNumber?: number) {
  const db = getDb()
  const tripRecord = await db.trip.findUnique({ where: { slug }, select: { id: true } })
  if (!tripRecord) return null
  await ensureCourseHoles(tripRecord.id)

  const trip = await db.trip.findUnique({
    where: { slug },
    include: {
      teams: { orderBy: [{ seed: 'asc' }, { name: 'asc' }], include: { players: { include: { player: true } } } },
      players: true,
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: {
          course: { include: { holes: { orderBy: { holeNumber: 'asc' } } } },
          scores: { include: { player: true } },
          matches: {
            orderBy: { matchNumber: 'asc' },
            include: {
              scores: { include: { player: true } },
              sides: {
                orderBy: { sideIndex: 'asc' },
                include: { team: true, players: { include: { player: true }, orderBy: { position: 'asc' } } },
              },
            },
          },
        },
      },
    },
  })
  if (!trip) return null

  const selectedRound =
    trip.rounds.find((round) => round.roundNumber === roundNumber) ??
    trip.rounds.find((round) => round.status === 'LIVE') ??
    trip.rounds[0]
  const roundSummaries = trip.rounds.sort(byRound).map((round) => summarizeRound(round))
  const totalPoints = roundSummaries.reduce<Record<string, number>>((sum, round) => {
    for (const [teamId, points] of Object.entries(round.pointsByTeam)) {
      sum[teamId] = (sum[teamId] ?? 0) + points
    }
    return sum
  }, {})

  return {
    trip: { slug: trip.slug, name: trip.name, status: trip.status },
    teams: trip.teams.map((team) => ({
      id: team.id,
      name: team.name,
      color: team.color,
      points: totalPoints[team.id] ?? 0,
      handicapTotal: team.players.reduce((sum, entry) => sum + (entry.player.handicap ?? 0), 0),
      players: team.players.map((entry) => playerSummary(entry.player)),
    })),
    selectedRound: selectedRound ? summarizeRound(selectedRound) : null,
    rounds: roundSummaries,
  }
}

export async function getPlayerCardData(slug: string) {
  const player = await getPlayerFromCookie(slug)
  if (!player) return null

  const db = getDb()
  const tripRecord = await db.trip.findUnique({ where: { slug }, select: { id: true } })
  if (!tripRecord) return null
  await ensureCourseHoles(tripRecord.id)

  const trip = await db.trip.findUnique({
    where: { slug },
    include: {
      teams: { include: { players: true } },
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: {
          course: { include: { holes: { orderBy: { holeNumber: 'asc' } } } },
          scores: { include: { player: true } },
          matches: {
            orderBy: { matchNumber: 'asc' },
            include: {
              scores: { include: { player: true } },
              sides: {
                orderBy: { sideIndex: 'asc' },
                include: { team: true, players: { include: { player: true }, orderBy: { position: 'asc' } } },
              },
            },
          },
        },
      },
    },
  })
  if (!trip) return null

  const round = trip.rounds.find((item) => item.status === 'LIVE') ?? trip.rounds[0]
  if (!round?.course) return null
  const holes = round.course.holes.sort(byHole)
  const myTeam = trip.teams.find((team) => team.players.some((entry) => entry.playerId === player.id))
  const match = round.matches.find((item) => item.sides.some((side) => side.players.some((entry) => entry.playerId === player.id)))
  const scoreMap = buildScoreMap(round.scores)
  const myScores = scoreMap[player.id] ?? {}

  let matchTimeline = null
  let status = `${Object.keys(myScores).length} holes posted`
  let partner = null
  let opponents: Array<ReturnType<typeof playerSummary>> = []
  let strokeSummary: Record<number, { gets: number; gives: number; label: string }> = {}

  if (match) {
    const sides = match.sides.map((side) => side.players.map((entry) => playerSummary(entry.player)))
    const mySideIndex = match.sides.findIndex((side) => side.players.some((entry) => entry.playerId === player.id))
    const otherSide = match.sides.find((_, index) => index !== mySideIndex)
    partner = match.sides[mySideIndex]?.players.find((entry) => entry.playerId !== player.id)?.player
    opponents = otherSide?.players.map((entry) => playerSummary(entry.player)) ?? []
    const holeStatuses = calculateMatchHoleStatuses({
      holes,
      sideOnePlayers: sides[0] ?? [],
      sideTwoPlayers: sides[1] ?? [],
      scores: match.scores,
      format: round.format,
    })
    const matchStatus = buildMatchStatus(holeStatuses, sideLabel(match.sides[0], 'Side 1'), sideLabel(match.sides[1], 'Side 2'))
    status = matchStatus.label
    matchTimeline = {
      leader: matchStatus.label,
      through: matchStatus.completedHoles,
      holes: holeStatuses.map((hole) => ({
        ...hole,
        display: hole.sideOneUpAfter == null ? '-' : formatTrend(hole.sideOneUpAfter, mySideIndex === 0),
        wonByPlayerSide: hole.result == null || hole.result === 'HALVED' ? null : mySideIndex === hole.result - 1,
      })),
    }

    const strokeMap = getMatchStrokeMap(sides as PlayerForScoring[][], holes, round.format)
    strokeSummary = buildStrokeSummary({ holes, playerId: player.id, strokeMap, opponentIds: opponents.map((item) => item.id) })
  } else {
    const strokeMap = getMatchStrokeMap([[playerSummary(player)]], holes, round.format)
    strokeSummary = buildStrokeSummary({ holes, playerId: player.id, strokeMap, opponentIds: [] })
  }

  return {
    trip: { slug: trip.slug, name: trip.name, scoreMax: trip.scoreMax },
    player: { ...playerSummary(player), teamName: myTeam?.name ?? null },
    partner: partner ? playerSummary(partner) : null,
    opponents,
    match: match ? { id: match.id, format: round.format, roundNumber: round.roundNumber } : { id: null, format: round.format, roundNumber: round.roundNumber },
    round: { id: round.id, roundNumber: round.roundNumber, name: round.name, format: round.format, formatLabel: formatLabel(round.format), status: round.status },
    course: { id: round.course.id, name: round.course.name, teeName: round.course.teeName, rating: round.course.rating, slope: round.course.slope, holes },
    myScores,
    strokeSummary,
    matchTimeline,
    status,
    submittedAt: null,
    teamScoring: isTeamFormat(round.format),
  }
}

function summarizeRound(round: any) {
  const holes = round.course?.holes ?? []
  const scoreMap = buildScoreMap(round.scores ?? [])
  const matchCards = round.matches.map((match: any) => {
    const sides = match.sides.map((side: any) => side.players.map((entry: any) => playerSummary(entry.player)))
    const holeStatuses = calculateMatchHoleStatuses({
      holes,
      sideOnePlayers: sides[0] ?? [],
      sideTwoPlayers: sides[1] ?? [],
      scores: match.scores,
      format: round.format,
    })
    const status = buildMatchStatus(holeStatuses, sideLabel(match.sides[0], 'Side 1'), sideLabel(match.sides[1], 'Side 2'))

    return {
      id: match.id,
      matchNumber: match.matchNumber,
      format: round.format,
      status,
      sides: match.sides.map((side: any, index: number) => ({
        id: side.id,
        sideIndex: side.sideIndex,
        teamId: side.teamId,
        label: sideLabel(side, `Side ${index + 1}`),
        players: side.players.map((entry: any) => playerSummary(entry.player)),
        points: index === 0 ? status.points.sideOne : index === 1 ? status.points.sideTwo : 0,
      })),
    }
  })

  const pointsByTeam: Record<string, number> = {}
  for (const match of matchCards) {
    for (const side of match.sides) {
      if (side.teamId) pointsByTeam[side.teamId] = (pointsByTeam[side.teamId] ?? 0) + side.points
    }
  }

  const players = [...new Map(round.scores.map((score: any) => [score.playerId, score.player])).values()].filter(Boolean)
  const rows = players.map((player: any) => {
    const scores = scoreMap[player.id] ?? {}
    const gross = Object.values(scores).reduce<number>((sum, score) => sum + score, 0)
    return {
      player: playerSummary(player),
      gross: Object.keys(scores).length ? gross : null,
      net: Object.keys(scores).length ? calculateNetTotal(scores, []) : null,
      holesPlayed: Object.keys(scores).length,
    }
  })

  return {
    id: round.id,
    roundNumber: round.roundNumber,
    name: round.name,
    format: round.format,
    formatLabel: formatLabel(round.format),
    status: round.status,
    course: round.course ? { name: round.course.name, teeName: round.course.teeName, rating: round.course.rating, slope: round.course.slope } : null,
    matchPlay: isMatchPlayFormat(round.format),
    teamScoring: isTeamFormat(round.format),
    pointsByTeam,
    matchCards,
    leaderboard: rows.sort((a, b) => (a.gross == null ? 1 : b.gross == null ? -1 : a.gross - b.gross)),
  }
}

function buildStrokeSummary(params: {
  holes: Array<{ holeNumber: number }>
  playerId: string
  strokeMap: Record<string, number[]>
  opponentIds: string[]
}) {
  return Object.fromEntries(
    params.holes.map((hole) => {
      const gets = countStrokes(params.strokeMap[params.playerId] ?? [], hole.holeNumber)
      const gives = Math.max(0, ...params.opponentIds.map((id) => countStrokes(params.strokeMap[id] ?? [], hole.holeNumber)))
      return [hole.holeNumber, { gets, gives, label: gets ? `You get ${gets}` : gives ? `You give ${gives}` : 'No strokes' }]
    })
  )
}

function countStrokes(strokeHoles: number[], holeNumber: number) {
  return strokeHoles.filter((number) => number === holeNumber).length
}

function formatTrend(value: number, isSideOne: boolean) {
  const sideValue = isSideOne ? value : -value
  if (sideValue === 0) return 'T'
  return sideValue > 0 ? `+${sideValue}` : `${sideValue}`
}
