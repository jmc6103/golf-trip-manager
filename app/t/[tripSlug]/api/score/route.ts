import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getPlayerFromCookie } from '@/lib/tenant-data'
import { maxScoreForHole } from '@/lib/scoring'

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
          matches: { include: { sides: { include: { players: true } } } },
        },
      },
    },
  })
  const round = trip?.rounds[0] ?? await db.round.findFirst({
    where: { trip: { slug: tripSlug } },
    orderBy: { roundNumber: 'asc' },
    include: { course: { include: { holes: true } }, matches: { include: { sides: { include: { players: true } } } } },
  })
  if (!trip || !round) return NextResponse.json({ error: 'No round found.' }, { status: 404 })

  const hole = round.course?.holes.find((item) => item.holeNumber === holeNumber)
  if (!hole) return NextResponse.json({ error: 'Hole not found.' }, { status: 404 })
  const max = maxScoreForHole(hole.par, trip.scoreMax)
  if (gross > max) return NextResponse.json({ error: `Max score for hole ${holeNumber} is ${max}.` }, { status: 400 })

  const match = round.matches.find((item) =>
    item.sides.some((side) => side.players.some((entry) => entry.playerId === player.id))
  )

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

  return NextResponse.json({ ok: true })
}
