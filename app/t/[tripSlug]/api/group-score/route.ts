import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getAuthorizedGroupScorekeeper } from '@/lib/group-scorekeeping'
import { getPlayerFromCookie } from '@/lib/tenant-data'
import { maxScoreForHole } from '@/lib/scoring'
import { emitScoreMilestones } from '@/lib/score-notifications'

export async function POST(req: Request, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const player = await getPlayerFromCookie(tripSlug)
  if (!player) return NextResponse.json({ error: 'No player session.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const roundId = String(body?.roundId ?? '')
  const targetPlayerId = String(body?.playerId ?? '')
  const holeNumber = Number(body?.holeNumber)
  const gross = Number(body?.gross)

  if (!roundId || !targetPlayerId || !Number.isInteger(holeNumber) || holeNumber < 1 || holeNumber > 18 || !Number.isInteger(gross) || gross < 1 || gross > 20) {
    return NextResponse.json({ error: 'Invalid score payload.' }, { status: 400 })
  }

  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug: tripSlug }, select: { id: true, scoreMax: true } })
  if (!trip) return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
  const targetPlayer = await db.player.findFirst({ where: { id: targetPlayerId, tripId: trip.id }, select: { id: true, name: true } })
  if (!targetPlayer) return NextResponse.json({ error: 'Player not found.' }, { status: 404 })
  const round = await db.round.findFirst({
    where: { id: roundId, tripId: trip.id },
    include: { course: { include: { holes: true } }, matches: { include: { sides: { include: { players: true } } } } },
  })
  if (!round) return NextResponse.json({ error: 'Round not found.' }, { status: 404 })
  if (round.status !== 'LIVE') return NextResponse.json({ error: 'This round is not open for scoring.' }, { status: 400 })

  const auth = await getAuthorizedGroupScorekeeper({ tripId: trip.id, roundId, scorekeeperPlayerId: player.id, targetPlayerId })
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 403 })

  const hole = round.course?.holes.find((item) => item.holeNumber === holeNumber)
  if (!hole) return NextResponse.json({ error: 'Hole not found.' }, { status: 404 })
  const max = maxScoreForHole(hole.par, trip.scoreMax)
  if (gross > max) return NextResponse.json({ error: `Max score for hole ${holeNumber} is ${max}.` }, { status: 400 })

  const match = round.matches.find((item) => item.sides.some((side) => side.players.some((entry) => entry.playerId === targetPlayerId)))
  await db.holeScore.upsert({
    where: { roundId_playerId_holeNumber: { roundId, playerId: targetPlayerId, holeNumber } },
    create: { tripId: trip.id, roundId, matchId: match?.id ?? null, holeId: hole.id, playerId: targetPlayerId, holeNumber, gross },
    update: { gross, matchId: match?.id ?? null, holeId: hole.id },
  })
  await emitScoreMilestones({
    tripId: trip.id,
    roundId,
    playerId: targetPlayer.id,
    playerName: targetPlayer.name,
    holeNumber,
    gross,
    par: hole.par,
  })

  return NextResponse.json({ ok: true })
}
