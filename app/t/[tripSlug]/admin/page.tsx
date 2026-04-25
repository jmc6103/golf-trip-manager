import { AdminConfigurator } from './admin-configurator'
import { createDefaultSetup } from '@/lib/trip-data'
import { getTripSummary, hasAdminAccess } from '@/lib/tenant-data'

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripSlug: string }>
  searchParams: Promise<{ adminToken?: string; ownerName?: string; ownerEmail?: string; tripName?: string }>
}) {
  const { tripSlug } = await params
  const query = await searchParams
  const trip = await getTripSummary(tripSlug)
  const fallback = createDefaultSetup(tripSlug, query.ownerName ?? '', query.tripName ?? '')
  fallback.ownerEmail = query.ownerEmail ?? ''
  fallback.adminToken = query.adminToken ?? fallback.adminToken
  const canAdmin = trip ? await hasAdminAccess(tripSlug, query.adminToken) : true

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
      </div>
    </main>
  )
}
