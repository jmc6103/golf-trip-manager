import { redirect } from 'next/navigation'
import { AdminConfigurator } from './admin-configurator'
import { AdminControlRoom } from './admin-control-room'
import { createDefaultSetup } from '@/lib/trip-data'
import { getTripDetail, getTripSummary, hasAdminAccess, setAdminCookie } from '@/lib/tenant-data'

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
        }} initialSetup={fallback} canAdmin={canAdmin} />
        {detail ? <AdminControlRoom trip={detail} canAdmin={canAdmin} /> : null}
      </div>
    </main>
  )
}
