import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import {
  adjustHandicap,
  emergencyWipe,
  finalizeRound,
  forceFinalizeRound,
  generateMatchesForTrip,
  generateTeamsForTrip,
  overrideScore,
  startRound,
  voidMatch,
} from '@/lib/trip-ops'
import { AdminRoleError, hasAdminAccess, requireRole } from '@/lib/tenant-data'

export async function POST(req: Request, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 })
  if (!(await hasAdminAccess(tripSlug))) return NextResponse.json({ error: 'Admin access required.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const action = String(body?.action ?? '')
  const db = getDb()

  try {
    if (action === 'generate-teams') {
      await requireRole(tripSlug, 'ADMIN')
      await generateTeamsForTrip(tripSlug)
    } else if (action === 'generate-matches') {
      await requireRole(tripSlug, 'ADMIN')
      await generateMatchesForTrip(tripSlug)
    } else if (action === 'start-round') {
      await requireRole(tripSlug, 'ADMIN')
      await startRound(tripSlug, String(body?.roundId ?? ''))
    } else if (action === 'finalize-round') {
      await requireRole(tripSlug, 'ADMIN')
      await finalizeRound(tripSlug, String(body?.roundId ?? ''))
    } else if (action === 'void-match') {
      await requireRole(tripSlug, 'OWNER')
      await voidMatch(tripSlug, String(body?.matchId ?? ''), String(body?.reason ?? '').trim())
    } else if (action === 'override-score') {
      await requireRole(tripSlug, 'OWNER')
      await overrideScore(tripSlug, {
        playerId: String(body?.playerId ?? ''),
        roundId: String(body?.roundId ?? ''),
        holeNumber: Number(body?.holeNumber),
        gross: Number(body?.gross),
        reason: String(body?.reason ?? '').trim(),
      })
    } else if (action === 'force-finalize') {
      await requireRole(tripSlug, 'OWNER')
      await forceFinalizeRound(tripSlug, String(body?.roundId ?? ''))
    } else if (action === 'emergency-wipe') {
      await requireRole(tripSlug, 'OWNER')
      await emergencyWipe(tripSlug)
    } else if (action === 'adjust-handicap') {
      await requireRole(tripSlug, 'OWNER')
      await adjustHandicap(tripSlug, String(body?.playerId ?? ''), Number(body?.newValue), String(body?.reason ?? '').trim())
    }
    else if (action === 'reset-round') {
      await requireRole(tripSlug, 'OWNER')
      const roundId = String(body?.roundId ?? '')
      const trip = await db.trip.findUnique({ where: { slug: tripSlug }, select: { id: true } })
      if (!trip) throw new Error('Trip not found.')
      await db.$transaction([
        db.holeScore.deleteMany({ where: { tripId: trip.id, roundId } }),
        db.round.update({ where: { id: roundId }, data: { status: 'NOT_STARTED', startedAt: null, finalizedAt: null } }),
        db.adminAction.create({ data: { tripId: trip.id, action: 'reset-round', payload: { roundId } } }),
      ])
    } else {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof AdminRoleError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Action failed.' }, { status: 400 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 })
  if (!(await hasAdminAccess(tripSlug))) return NextResponse.json({ error: 'Admin access required.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug: tripSlug }, select: { id: true } })
  if (!trip) return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })

  try {
    await requireRole(tripSlug, 'ADMIN')
  } catch (error) {
    if (error instanceof AdminRoleError) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

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

  if (body?.type === 'player-tee') {
    const playerId = String(body.playerId ?? '')
    const roundId = String(body.roundId ?? '')
    const teeName = String(body.teeName ?? '').trim()
    if (!playerId || !roundId) return NextResponse.json({ error: 'Player and round are required.' }, { status: 400 })
    if (!teeName) await db.playerRoundTee.deleteMany({ where: { playerId, roundId } })
    else {
      await db.playerRoundTee.upsert({
        where: { playerId_roundId: { playerId, roundId } },
        create: { playerId, roundId, teeName },
        update: { teeName },
      })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown update.' }, { status: 400 })
}
