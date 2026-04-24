import { notFound } from 'next/navigation'
import { getTrip } from '@/lib/trip-data'

export default async function TeamPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = getTrip(tripSlug)
  if (!trip) notFound()

  return (
    <main className="min-h-screen px-4 py-5 text-slate-950">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Live Team Board</p>
          <h1 className="mt-2 text-3xl font-black">Blue leads</h1>
          <p className="mt-2 text-sm font-semibold text-slate-300">{trip.name}</p>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Score label="Blue" value="3.5" />
            <span className="text-sm font-black text-slate-400">VS</span>
            <Score label="Red" value="2.5" />
          </div>
        </section>
        {trip.formats.map((format, index) => (
          <section key={format} className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Round {index + 1}</p>
            <h2 className="mt-1 text-xl font-black">{format}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Live scoring summary for this trip.</p>
          </section>
        ))}
      </div>
    </main>
  )
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white/10 p-4 text-center ring-1 ring-white/15">
      <p className="text-xs font-black uppercase tracking-wide text-slate-300">{label}</p>
      <p className="mt-1 text-4xl font-black">{value}</p>
    </div>
  )
}
