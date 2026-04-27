import { redirect } from 'next/navigation'
import { AdminConfigurator } from './admin-configurator'
import { AdminControlRoom } from './admin-control-room'
import { createDefaultSetup } from '@/lib/trip-data'
import { getTripDetail, getTripSummary, hasAdminAccess, setAdminCookie } from '@/lib/tenant-data'
import type { CourseDraft, TripSetupDraft } from '@/lib/types'

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripSlug: string }>
  searchParams: Promise<{ adminToken?: string; ownerName?: string; ownerEmail?: string; tripName?: string }>
}) {
  const { tripSlug } = await params
  const query = await searchParams

  // One-time token exchange: validate token, set cookie, strip token from URL
  if (query.adminToken) {
    const trip = await getTripSummary(tripSlug)
    if (trip && await hasAdminAccess(tripSlug, query.adminToken)) {
      await setAdminCookie(tripSlug, query.adminToken)
      redirect(`/t/${tripSlug}/admin`)
    }
  }

  const trip = await getTripSummary(tripSlug)
  const detail = trip ? await getTripDetail(tripSlug) : null
  const fallback = createDefaultSetup(tripSlug, query.ownerName ?? '', query.tripName ?? '')
  fallback.ownerEmail = query.ownerEmail ?? ''
  const initialSetup = detail ? setupFromDetail(detail) : fallback
  const canAdmin = trip ? await hasAdminAccess(tripSlug) : true

  return (
    <main className="min-h-screen px-4 py-5 text-slate-950">
      <div className="mx-auto max-w-md space-y-4">
        <AdminConfigurator trip={trip ?? {
          slug: fallback.slug,
          name: fallback.tripName,
          dates: 'Dates to be set',
          location: 'Location to be set',
          status: 'DRAFT',
          playerCount: 0,
          maxPlayers: fallback.playerCount,
          formats: ['Setup underway'],
        }} initialSetup={initialSetup} canAdmin={canAdmin} isExistingTrip={Boolean(detail)} />
        {detail ? <AdminControlRoom trip={detail} canAdmin={canAdmin} /> : null}
      </div>
    </main>
  )
}

function setupFromDetail(trip: NonNullable<Awaited<ReturnType<typeof getTripDetail>>>): TripSetupDraft {
  const owner = trip.adminIdentities[0]
  return {
    ownerName: owner?.name ?? '',
    ownerEmail: owner?.email ?? '',
    adminToken: '',
    tripName: trip.name,
    slug: trip.slug,
    templateId: trip.template,
    playerCount: trip.maxPlayers,
    dayCount: trip.dayCount,
    roundCount: trip.roundCount,
    formats: trip.rounds.map((round) => round.format),
    rulesMode: trip.rulesMode,
    scoreMax: trip.scoreMax,
    teamMethod: trip.teamMethod,
    pairingMethod: trip.pairingMethod,
    courses: trip.courses.map((course): CourseDraft => ({
      day: course.dayNumber,
      name: course.name,
      teeName: course.teeName ?? '',
      rating: course.rating == null ? '' : String(course.rating),
      slope: course.slope == null ? '' : String(course.slope),
      holes: course.holes.map((hole) => ({
        holeNumber: hole.holeNumber,
        par: hole.par,
        strokeIndex: hole.strokeIndex,
        yardage: hole.yardage ?? undefined,
      })),
      source: course.source === 'GOLF_COURSE_API' ? 'golfcourseapi' : course.source === 'BLUEGOLF' ? 'bluegolf' : 'manual',
      sourceId: course.sourceId ?? undefined,
      blueGolfUrl: course.blueGolfUrl ?? undefined,
    })),
  }
}
