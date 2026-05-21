import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getAuthorizedGroupScorekeeper } from '@/lib/group-scorekeeping'
import { getPlayerFromCookie } from '@/lib/tenant-data'

export async function POST(req: Request, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const player = await getPlayerFromCookie(tripSlug)
  if (!player) return NextResponse.json({ error: 'No player session.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const roundId = String(body?.roundId ?? '')
  if (!roundId) return NextResponse.json({ error: 'Round is required.' }, { status: 400 })

  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug: tripSlug }, select: { id: true } })
  if (!trip) return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
  const round = await db.round.findFirst({ where: { id: roundId, tripId: trip.id }, include: { course: { include: { holes: true } } } })
  if (!round?.course) return NextResponse.json({ error: 'Round course not found.' }, { status: 404 })
  if (round.status !== 'LIVE') return NextResponse.json({ error: 'This round is not open for submission.' }, { status: 400 })

  const auth = await getAuthorizedGroupScorekeeper({ tripId: trip.id, roundId, scorekeeperPlayerId: player.id })
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 403 })

  const scores = await db.holeScore.findMany({ where: { roundId, playerId: { in: auth.memberIds } }, select: { playerId: true, holeNumber: true, gross: true } })
  const holesByPlayer = new Map<string, Set<number>>()
  for (const score of scores) holesByPlayer.set(score.playerId, (holesByPlayer.get(score.playerId) ?? new Set()).add(score.holeNumber))
  const incompletePlayerId = auth.memberIds.find((id) => (holesByPlayer.get(id)?.size ?? 0) < round.course!.holes.length)
  if (incompletePlayerId) return NextResponse.json({ error: 'A group member still has missing holes.' }, { status: 400 })

  const now = new Date()
  await db.$transaction(auth.memberIds.map((memberId) => {
    const memberScores = scores.filter((score) => score.playerId === memberId)
    const grossTotal = memberScores.reduce((sum, score) => sum + score.gross, 0)
    return db.roundSubmission.upsert({
      where: { roundId_playerId: { roundId, playerId: memberId } },
      create: { tripId: trip.id, roundId, playerId: memberId, grossTotal, submittedAt: now },
      update: { grossTotal, submittedAt: now },
    })
  }))

  return NextResponse.json({ ok: true, submittedAt: now })
}
