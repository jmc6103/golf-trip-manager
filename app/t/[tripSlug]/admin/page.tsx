import { AdminConfigurator } from './admin-configurator'
import { getTrip } from '@/lib/trip-data'

export default async function AdminPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = getTrip(tripSlug)

  return (
    <main className="min-h-screen px-4 py-5 text-slate-950">
      <div className="mx-auto max-w-md space-y-4">
        <AdminConfigurator trip={trip} />
      </div>
    </main>
  )
}
