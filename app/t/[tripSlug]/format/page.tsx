import { notFound } from 'next/navigation'
import { getTrip } from '@/lib/trip-data'

export default async function FormatPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = getTrip(tripSlug)
  if (!trip) notFound()

  return (
    <main className="min-h-screen px-4 py-5 text-slate-950">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Format Guide</p>
          <h1 className="mt-2 text-3xl font-black">{trip.name}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-300">Trip-specific scoring rules and casual local rules live here.</p>
        </section>
        {trip.formats.map((format) => (
          <section key={format} className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-black">{format}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Allowance, max score, match points, and local rules would be configurable per trip.</p>
          </section>
        ))}
      </div>
    </main>
  )
}
