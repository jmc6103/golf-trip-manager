import { cookies } from 'next/headers'
import { createHash, randomBytes } from 'node:crypto'
import type { CourseSource, RoundFormat, Trip, TripRole } from '@prisma/client'
import { getDb } from './db'
import { formatOptions } from './trip-data'
import type { TripSetupDraft, TripSummary } from './types'

export type TripDetail = Awaited<ReturnType<typeof getTripDetail>>

export function createAccessToken() {
  return randomBytes(24).toString('base64url')
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function listTripSummaries(): Promise<TripSummary[]> {
  const db = getDb()
  const trips = await db.trip.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { players: true } },
      rounds: { orderBy: { roundNumber: 'asc' } },
    },
  })

  return trips.map(toTripSummary)
}

export async function getTripSummary(slug: string): Promise<TripSummary | null> {
  const db = getDb()
  const trip = await db.trip.findUnique({
    where: { slug },
    include: {
      _count: { select: { players: true } },
      rounds: { orderBy: { roundNumber: 'asc' } },
    },
  })

  return trip ? toTripSummary(trip) : null
}

export async function getTripDetail(slug: string) {
  const db = getDb()
  return db.trip.findUnique({
    where: { slug },
    include: {
      adminIdentities: { orderBy: { createdAt: 'asc' } },
      players: { orderBy: { registeredAt: 'asc' } },
      teams: {
        orderBy: [{ seed: 'asc' }, { name: 'asc' }],
        include: { players: { include: { player: true } }, sides: true },
      },
      courses: { orderBy: { dayNumber: 'asc' }, include: { holes: { orderBy: { holeNumber: 'asc' } } } },
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: {
          course: true,
          matches: {
            orderBy: { matchNumber: 'asc' },
            include: {
              sides: {
                orderBy: { sideIndex: 'asc' },
                include: { team: true, players: { include: { player: true }, orderBy: { position: 'asc' } } },
              },
            },
          },
        },
      },
      _count: { select: { players: true } },
    },
  })
}

export async function getPlayerFromCookie(slug: string) {
  const cookieStore = await cookies()
  const token = cookieStore.get(playerCookieName(slug))?.value
  if (!token) return null

  const db = getDb()
  return db.player.findFirst({
    where: { accessToken: token, trip: { slug } },
    include: { trip: true, teamMemberships: { include: { team: true } } },
  })
}

export async function hasAdminAccess(slug: string, queryToken?: string) {
  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug }, select: { adminTokenHash: true } })
  if (!trip?.adminTokenHash) return false

  const cookieStore = await cookies()
  const token = queryToken || cookieStore.get(adminCookieName(slug))?.value
  return token ? hashToken(token) === trip.adminTokenHash : false
}

export async function setAdminCookie(slug: string, token: string) {
  const cookieStore = await cookies()
  cookieStore.set(adminCookieName(slug), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 180,
    path: `/t/${slug}`,
  })
}

export async function setPlayerCookie(slug: string, token: string) {
  const cookieStore = await cookies()
  cookieStore.set(playerCookieName(slug), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 180,
    path: `/t/${slug}`,
  })
}

export async function upsertTripFromSetup(setup: TripSetupDraft) {
  const db = getDb()
  const adminToken = setup.adminToken || createAccessToken()
  const formats = setup.formats.length ? setup.formats : ['STROKE_BLIND']

  const trip = await db.trip.upsert({
    where: { slug: setup.slug },
    create: {
      slug: setup.slug,
      name: setup.tripName,
      status: 'REGISTRATION',
      template: setup.templateId,
      maxPlayers: setup.playerCount,
      dayCount: setup.dayCount,
      roundCount: setup.roundCount,
      rulesMode: setup.rulesMode,
      scoreMax: setup.scoreMax,
      teamMethod: setup.teamMethod,
      pairingMethod: setup.pairingMethod,
      adminTokenHash: hashToken(adminToken),
      adminIdentities: {
        create: setup.ownerEmail
          ? [{ name: setup.ownerName || 'Trip Owner', email: setup.ownerEmail.toLowerCase(), role: 'OWNER' as TripRole }]
          : [],
      },
    },
    update: {
      name: setup.tripName,
      status: 'REGISTRATION',
      template: setup.templateId,
      maxPlayers: setup.playerCount,
      dayCount: setup.dayCount,
      roundCount: setup.roundCount,
      rulesMode: setup.rulesMode,
      scoreMax: setup.scoreMax,
      teamMethod: setup.teamMethod,
      pairingMethod: setup.pairingMethod,
      adminTokenHash: hashToken(adminToken),
    },
  })

  if (setup.ownerEmail) {
    await db.adminIdentity.upsert({
      where: { tripId_email: { tripId: trip.id, email: setup.ownerEmail.toLowerCase() } },
      create: { tripId: trip.id, name: setup.ownerName || 'Trip Owner', email: setup.ownerEmail.toLowerCase(), role: 'OWNER' },
      update: { name: setup.ownerName || 'Trip Owner', role: 'OWNER' },
    })
  }

  await Promise.all(
    setup.courses.map((course) =>
      db.course.upsert({
        where: { tripId_dayNumber: { tripId: trip.id, dayNumber: course.day } },
        create: {
          tripId: trip.id,
          dayNumber: course.day,
          name: course.name || `Day ${course.day} Course`,
          teeName: course.teeName || null,
          rating: parseNullableFloat(course.rating),
          slope: parseNullableInt(course.slope),
          source: normalizeCourseSource(course.source),
          sourceId: course.sourceId || null,
          blueGolfUrl: course.blueGolfUrl || null,
        },
        update: {
          name: course.name || `Day ${course.day} Course`,
          teeName: course.teeName || null,
          rating: parseNullableFloat(course.rating),
          slope: parseNullableInt(course.slope),
          source: normalizeCourseSource(course.source),
          sourceId: course.sourceId || null,
          blueGolfUrl: course.blueGolfUrl || null,
        },
      })
    )
  )

  const courses = await db.course.findMany({ where: { tripId: trip.id }, orderBy: { dayNumber: 'asc' } })
  await Promise.all(
    Array.from({ length: setup.roundCount }, (_, index) => {
      const roundNumber = index + 1
      const format = normalizeRoundFormat(formats[index] ?? formats[formats.length - 1])
      const dayNumber = Math.min(roundNumber, Math.max(setup.dayCount, 1))
      const course = courses.find((item) => item.dayNumber === dayNumber) ?? courses[0]

      return db.round.upsert({
        where: { tripId_roundNumber: { tripId: trip.id, roundNumber } },
        create: {
          tripId: trip.id,
          courseId: course?.id,
          dayNumber,
          roundNumber,
          name: `Round ${roundNumber}`,
          format,
          handicapAllowance: 100,
          pointsAvailable: 1,
        },
        update: {
          courseId: course?.id,
          dayNumber,
          name: `Round ${roundNumber}`,
          format,
        },
      })
    })
  )

  await setAdminCookie(setup.slug, adminToken)
  return { trip, adminToken }
}

function toTripSummary(
  trip: Trip & { _count: { players: number }; rounds: Array<{ format: RoundFormat }> }
): TripSummary {
  return {
    slug: trip.slug,
    name: trip.name,
    dates: formatDateRange(trip.startsOn, trip.endsOn),
    location: trip.location ?? 'Location to be set',
    status: trip.status,
    playerCount: trip._count.players,
    maxPlayers: trip.maxPlayers,
    formats: trip.rounds.length ? trip.rounds.map((round) => formatLabel(round.format)) : ['Setup underway'],
  }
}

function formatDateRange(startsOn: Date | null, endsOn: Date | null) {
  if (!startsOn && !endsOn) return 'Dates to be set'
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (startsOn && endsOn) return `${formatter.format(startsOn)} - ${formatter.format(endsOn)}`
  return formatter.format(startsOn ?? endsOn!)
}

export function formatLabel(format: RoundFormat | string) {
  return formatOptions.find((option) => option.id === format)?.name ?? String(format).replace(/_/g, ' ')
}

function adminCookieName(slug: string) {
  return `gtm_admin_${slug}`
}

function playerCookieName(slug: string) {
  return `gtm_player_${slug}`
}

function parseNullableFloat(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && value.trim() ? parsed : null
}

function parseNullableInt(value: string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && value.trim() ? parsed : null
}

function normalizeRoundFormat(value: string): RoundFormat {
  const allowed = new Set(['FOUR_BALL', 'SINGLES', 'STROKE_BLIND', 'ALT_SHOT', 'SCRAMBLE', 'SHAMBLE', 'STABLEFORD'])
  return (allowed.has(value) ? value : 'STROKE_BLIND') as RoundFormat
}

function normalizeCourseSource(value: TripSetupDraft['courses'][number]['source']): CourseSource {
  if (value === 'golfcourseapi') return 'GOLF_COURSE_API'
  if (value === 'bluegolf') return 'BLUEGOLF'
  return 'MANUAL'
}
