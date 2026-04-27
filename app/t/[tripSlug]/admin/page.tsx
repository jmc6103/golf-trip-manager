import { AdminConfigurator } from './admin-configurator'
import { AdminControlRoom } from './admin-control-room'
import { loginTripAdmin } from '@/app/actions'
import { redirect } from 'next/navigation'
import { createDefaultSetup } from '@/lib/trip-data'
import { getTripDetail, getTripSummary, hasAdminAccess } from '@/lib/tenant-data'
import type { CourseDraft, TripSetupDraft } from '@/lib/types'

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripSlug: string }>
  searchParams: Promise<{ adminToken?: string; ownerName?: string; ownerEmail?: string; tripName?: string; adminError?: string }>
}) {
  const { tripSlug } = await params
  const query = await searchParams

  if (query.adminToken) {
    redirect(`/t/${tripSlug}/admin/access?adminToken=${encodeURIComponent(query.adminToken)}`)
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
        {detail && !canAdmin ? <AdminLogin slug={tripSlug} error={query.adminError} /> : null}
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
    adminPassword: '',
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

function AdminLogin({ slug, error }: { slug: string; error?: string }) {
  const message = error === 'bad-password' ? 'That admin password did not match.' : error === 'password-required' ? 'Enter the admin password.' : ''
  return (
    <form action={loginTripAdmin} className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <input type="hidden" name="slug" value={slug} />
      <p className="text-sm font-black uppercase tracking-wide text-slate-500">Admin Access</p>
      {message ? <p className="mt-2 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-800 ring-1 ring-rose-100">{message}</p> : null}
      <div className="mt-3 flex gap-2">
        <input
          name="adminPassword"
          type="password"
          className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 font-bold"
          placeholder="Admin password"
        />
        <button className="rounded-2xl bg-slate-950 px-4 py-3 font-black text-white">Unlock</button>
      </div>
    </form>
  )
}
