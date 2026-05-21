import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getPlayerFromCookie } from '@/lib/tenant-data'
import { buildMatchStatus, calculateMatchHoleStatuses, calculateNetTotal, maxScoreForHole } from '@/lib/scoring'

export async function POST(req: Request, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const player = await getPlayerFromCookie(tripSlug)
  if (!player) return NextResponse.json({ error: 'No player session.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const holeNumber = Number(body?.holeNumber)
  const gross = Number(body?.gross)
  const db = getDb()

  if (!Number.isInteger(holeNumber) || holeNumber < 1 || holeNumber > 18) {
    return NextResponse.json({ error: 'Invalid hole number.' }, { status: 400 })
  }
  if (!Number.isInteger(gross) || gross < 1 || gross > 20) {
    return NextResponse.json({ error: 'Invalid score.' }, { status: 400 })
  }

  const trip = await db.trip.findUnique({
    where: { slug: tripSlug },
    include: {
      rounds: {
        where: { status: 'LIVE' },
        include: {
          course: { include: { holes: true } },
          matches: { include: { scores: true, sides: { include: { team: true, players: { include: { player: true } } } } } },
        },
      },
    },
  })
  const round = trip?.rounds[0] ?? await db.round.findFirst({
    where: { trip: { slug: tripSlug } },
    orderBy: { roundNumber: 'asc' },
    include: { course: { include: { holes: true } }, matches: { include: { scores: true, sides: { include: { team: true, players: { include: { player: true } } } } } } },
  })
  if (!trip || !round) return NextResponse.json({ error: 'No round found.' }, { status: 404 })

  const hole = round.course?.holes.find((item) => item.holeNumber === holeNumber)
  if (!hole) return NextResponse.json({ error: 'Hole not found.' }, { status: 404 })
  const max = maxScoreForHole(hole.par, trip.scoreMax)
  if (gross > max) return NextResponse.json({ error: `Max score for hole ${holeNumber} is ${max}.` }, { status: 400 })

  const match = round.matches.find((item) =>
    item.sides.some((side) => side.players.some((entry) => entry.playerId === player.id))
  )
  const beforeStatus = match ? matchStatusLabel(match, round.course!.holes, round.format) : null

  await db.holeScore.upsert({
    where: { roundId_playerId_holeNumber: { roundId: round.id, playerId: player.id, holeNumber } },
    create: {
      tripId: trip.id,
      roundId: round.id,
      matchId: match?.id ?? null,
      holeId: hole.id,
      playerId: player.id,
      holeNumber,
      gross,
    },
    update: { gross, matchId: match?.id ?? null, holeId: hole.id },
  })

  const playerScores = await db.holeScore.findMany({
    where: { roundId: round.id, playerId: player.id },
    select: { holeNumber: true, gross: true },
  })
  const distinctHoles = new Set(playerScores.map((score) => score.holeNumber))
  if (round.course && distinctHoles.size === round.course.holes.length) {
    const scoreMap = Object.fromEntries(playerScores.map((score) => [score.holeNumber, score.gross]))
    await db.roundSubmission.upsert({
      where: { roundId_playerId: { roundId: round.id, playerId: player.id } },
      create: {
        tripId: trip.id,
        roundId: round.id,
        playerId: player.id,
        grossTotal: playerScores.reduce((sum, score) => sum + score.gross, 0),
        netTotal: calculateNetTotal(scoreMap, []),
        submittedAt: new Date(),
      },
      update: {
        grossTotal: playerScores.reduce((sum, score) => sum + score.gross, 0),
        netTotal: calculateNetTotal(scoreMap, []),
        submittedAt: new Date(),
      },
    })
  }

  if (match && beforeStatus) {
    const freshMatch = await db.match.findUnique({
      where: { id: match.id },
      include: { scores: { include: { player: true } }, sides: { orderBy: { sideIndex: 'asc' }, include: { team: true, players: { include: { player: true }, orderBy: { position: 'asc' } } } } },
    })
    const afterStatus = freshMatch ? matchStatusLabel(freshMatch, round.course!.holes, round.format) : null
    if (afterStatus && afterStatus !== beforeStatus) {
      await db.notificationEvent.create({
        data: { tripId: trip.id, type: 'MATCH_STATUS', payload: { matchId: match.id, roundId: round.id, status: afterStatus } },
      })
    }
  }

  return NextResponse.json({ ok: true })
}

function matchStatusLabel(
  match: {
    scores: Array<{ playerId: string; holeNumber: number; gross: number }>
    sides: Array<{ label: string | null; team: { name: string } | null; players: Array<{ player: { id: string; name: string; handicap: number | null } }> }>
  },
  holes: Array<{ holeNumber: number; par: number; strokeIndex: number }>,
  format: string
) {
  const sides = match.sides.map((side) => side.players.map((entry) => ({ id: entry.player.id, name: entry.player.name, handicap: entry.player.handicap ?? 0 })))
  const statuses = calculateMatchHoleStatuses({
    holes,
    sideOnePlayers: sides[0] ?? [],
    sideTwoPlayers: sides[1] ?? [],
    scores: match.scores,
    format,
  })
  return buildMatchStatus(statuses, sideLabel(match.sides[0], 'Side 1'), sideLabel(match.sides[1], 'Side 2')).label
}

function sideLabel(side: { label: string | null; team: { name: string } | null } | undefined, fallback: string) {
  return side?.team?.name ?? side?.label ?? fallback
}
