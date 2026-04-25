'use server'

import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import { createAccessToken, hashToken, hasAdminAccess, setAdminCookie, setPlayerCookie, upsertTripFromSetup } from '@/lib/tenant-data'
import type { TripSetupDraft } from '@/lib/types'

export async function saveTripSetup(setup: TripSetupDraft) {
  const db = getDb()
  const existing = await db.trip.findUnique({ where: { slug: setup.slug }, select: { adminTokenHash: true } })
  if (existing?.adminTokenHash) {
    const tokenMatches = setup.adminToken ? hashToken(setup.adminToken) === existing.adminTokenHash : false
    const cookieMatches = await hasAdminAccess(setup.slug)
    if (!tokenMatches && !cookieMatches) throw new Error('Use the private admin link to update this trip.')
    if (tokenMatches) await setAdminCookie(setup.slug, setup.adminToken)
  }

  const { adminToken } = await upsertTripFromSetup(setup)
  return { adminUrl: `/t/${setup.slug}/admin?adminToken=${encodeURIComponent(adminToken)}` }
}

export async function joinTrip(formData: FormData) {
  const slug = String(formData.get('slug') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const handicapValue = String(formData.get('handicap') ?? '').trim()
  const handicap = handicapValue ? Number(handicapValue) : null

  if (!slug || !name) {
    throw new Error('Trip and player name are required.')
  }

  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug }, select: { id: true, maxPlayers: true, _count: { select: { players: true } } } })
  if (!trip) throw new Error('Trip not found.')
  if (trip._count.players >= trip.maxPlayers) throw new Error('This trip is already full.')

  const existing = await db.player.findUnique({ where: { tripId_name: { tripId: trip.id, name } } })
  const accessToken = existing?.accessToken ?? createAccessToken()

  const player = await db.player.upsert({
    where: { tripId_name: { tripId: trip.id, name } },
    create: {
      tripId: trip.id,
      name,
      email: email || null,
      handicap: Number.isFinite(handicap) ? handicap : null,
      accessToken,
    },
    update: {
      email: email || null,
      handicap: Number.isFinite(handicap) ? handicap : null,
    },
  })

  await setPlayerCookie(slug, player.accessToken)
  redirect(`/t/${slug}/player`)
}
