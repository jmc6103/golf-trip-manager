import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getPlayerFromCookie } from '@/lib/tenant-data'
import { updateFoursomeScorekeeper } from '@/lib/trip-ops'

export async function PATCH(req: Request, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const player = await getPlayerFromCookie(tripSlug)
  if (!player) return NextResponse.json({ error: 'No player session.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const roundId = String(body?.roundId ?? '')
  const scorekeeperPlayerId = String(body?.scorekeeperPlayerId ?? '').trim() || null
  if (!roundId) return NextResponse.json({ error: 'Round is required.' }, { status: 400 })

  try {
    await updateFoursomeScorekeeper(tripSlug, player.id, roundId, scorekeeperPlayerId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update scorekeeper.' }, { status: 400 })
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const player = await getPlayerFromCookie(tripSlug)
  if (!player) return NextResponse.json({ error: 'No player session.' }, { status: 401 })

  const db = getDb()
  const round = await db.round.findFirst({ where: { trip: { slug: tripSlug }, status: 'LIVE' }, select: { id: true } })
  if (!round) return NextResponse.json({ error: 'No live round.' }, { status: 404 })
  const group = await db.foursome.findFirst({
    where: {
      roundId: round.id,
      OR: [{ player1Id: player.id }, { player2Id: player.id }, { player3Id: player.id }, { player4Id: player.id }],
    },
  })
  return NextResponse.json({ group })
}
