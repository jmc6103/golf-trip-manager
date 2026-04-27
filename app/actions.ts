'use server'

import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import { adminPasswordCookieValue, clearPlayerCookie, createAccessToken, hashToken, hasAdminAccess, setAdminCookie, setPlayerCookie, upsertTripFromSetup } from '@/lib/tenant-data'
import type { TripSetupDraft } from '@/lib/types'

export async function saveTripSetup(setup: TripSetupDraft) {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured for this deployment.')
  }

  const db = getDb()
  const existing = await db.trip.findUnique({ where: { slug: setup.slug }, select: { adminTokenHash: true, adminPasswordHash: true } })
  if (existing?.adminTokenHash || existing?.adminPasswordHash) {
    const tokenMatches = setup.adminToken ? hashToken(setup.adminToken) === existing.adminTokenHash : false
    const passwordMatches = setup.adminPassword.trim() && existing.adminPasswordHash ? hashToken(setup.adminPassword.trim()) === existing.adminPasswordHash : false
    const cookieMatches = await hasAdminAccess(setup.slug)
    if (!tokenMatches && !passwordMatches && !cookieMatches) return { error: 'Use the private admin link or admin password to update this trip.' }
    if (tokenMatches) await setAdminCookie(setup.slug, setup.adminToken)
    if (passwordMatches && existing.adminPasswordHash) await setAdminCookie(setup.slug, adminPasswordCookieValue(existing.adminPasswordHash))
  }

  const { trip, adminToken } = await upsertTripFromSetup(setup, { preserveAdminToken: Boolean(existing?.adminTokenHash) })
  const adminUrl = adminToken ? `/t/${setup.slug}/admin?adminToken=${encodeURIComponent(adminToken)}` : `/t/${setup.slug}/admin`
  return {
    adminUrl,
    inviteUrl: `/t/${setup.slug}/join?code=${trip.inviteCode}`,
    adminToken,
  }
}

export async function loginTripAdmin(formData: FormData) {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured for this deployment.')
  }

  const slug = String(formData.get('slug') ?? '')
  const password = String(formData.get('adminPassword') ?? '').trim()
  if (!slug || !password) redirect(slug ? `/t/${slug}/admin?adminError=password-required` : '/')

  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug }, select: { adminPasswordHash: true } })
  if (!trip?.adminPasswordHash || hashToken(password) !== trip.adminPasswordHash) {
    redirect(`/t/${slug}/admin?adminError=bad-password`)
  }

  await setAdminCookie(slug, adminPasswordCookieValue(trip.adminPasswordHash))
  redirect(`/t/${slug}/admin`)
}

export async function joinTrip(formData: FormData) {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured for this deployment.')
  }

  const slug = String(formData.get('slug') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const handicapValue = String(formData.get('handicap') ?? '').trim()
  const handicap = handicapValue ? Number(handicapValue) : null
  const inviteCode = String(formData.get('inviteCode') ?? '').trim()

  if (!slug || !name) {
    throw new Error('Trip and player name are required.')
  }

  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug }, select: { id: true, maxPlayers: true, inviteCode: true, _count: { select: { players: true } } } })
  if (!trip) throw new Error('Trip not found.')
  if (trip.inviteCode !== inviteCode) throw new Error('Invalid invite link. Please use the link shared by the trip organizer.')
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

export async function leaveTrip(formData: FormData) {
  const slug = String(formData.get('slug') ?? '')
  if (!slug) return
  await clearPlayerCookie(slug)
  redirect(`/t/${slug}`)
}
