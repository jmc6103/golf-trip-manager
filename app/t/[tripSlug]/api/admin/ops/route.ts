import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { generateMatchesForTrip, generateTeamsForTrip, startRound, finalizeRound } from '@/lib/trip-ops'
import { hasAdminAccess } from '@/lib/tenant-data'

export async function POST(req: Request, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  if (!(await hasAdminAccess(tripSlug))) return NextResponse.json({ error: 'Admin access required.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const action = String(body?.action ?? '')
  const db = getDb()

  try {
    if (action === 'generate-teams') await generateTeamsForTrip(tripSlug)
    else if (action === 'generate-matches') await generateMatchesForTrip(tripSlug)
    else if (action === 'start-round') await startRound(tripSlug, String(body?.roundId ?? ''))
    else if (action === 'finalize-round') await finalizeRound(tripSlug, String(body?.roundId ?? ''))
    else if (action === 'reset-round') {
      const roundId = String(body?.roundId ?? '')
      const trip = await db.trip.findUnique({ where: { slug: tripSlug }, select: { id: true } })
      if (!trip) throw new Error('Trip not found.')
      await db.holeScore.deleteMany({ where: { tripId: trip.id, roundId } })
      await db.round.update({ where: { id: roundId }, data: { status: 'NOT_STARTED', startedAt: null, finalizedAt: null } })
    } else {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Action failed.' }, { status: 400 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  if (!(await hasAdminAccess(tripSlug))) return NextResponse.json({ error: 'Admin access required.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug: tripSlug }, select: { id: true } })
  if (!trip) return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })

  if (body?.type === 'team-assignment') {
    const playerId = String(body.playerId ?? '')
    const teamId = String(body.teamId ?? '')
    await db.teamPlayer.deleteMany({ where: { playerId, team: { tripId: trip.id } } })
    if (teamId) await db.teamPlayer.create({ data: { playerId, teamId } })
    return NextResponse.json({ ok: true })
  }

  if (body?.type === 'team') {
    const id = String(body.id ?? '')
    const name = String(body.name ?? '').trim()
    if (!name) return NextResponse.json({ error: 'Team name is required.' }, { status: 400 })
    if (id) await db.team.update({ where: { id }, data: { name } })
    else await db.team.create({ data: { tripId: trip.id, name } })
    return NextResponse.json({ ok: true })
  }

  if (body?.type === 'match-side') {
    const sideId = String(body.sideId ?? '')
    const playerIds: string[] = Array.isArray(body.playerIds) ? body.playerIds.map(String).filter(Boolean) : []
    await db.matchPlayer.deleteMany({ where: { matchSideId: sideId } })
    await db.matchPlayer.createMany({ data: playerIds.map((playerId, index) => ({ matchSideId: sideId, playerId, position: index + 1 })) })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown update.' }, { status: 400 })
}
