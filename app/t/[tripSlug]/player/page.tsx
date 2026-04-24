import { notFound } from 'next/navigation'
import { getTrip } from '@/lib/trip-data'

export default async function PlayerPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = getTrip(tripSlug)
  if (!trip) notFound()

  return (
    <main className="min-h-screen px-4 py-5 text-slate-950">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Player Card</p>
          <h1 className="mt-2 text-3xl font-black">{trip.name}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-300">Personal score entry would use the trip slug plus player session token.</p>
        </section>
        <section className="sticky top-0 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Live Match</p>
          <h2 className="mt-1 text-xl font-black">Blue 1 Up thru 7</h2>
        </section>
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Hole 8 of 18</p>
          <h2 className="mt-2 text-3xl font-black">Hole 8</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Par 3 - triple bogey max</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((score) => (
              <button key={score} className="min-h-14 rounded-2xl bg-slate-50 text-lg font-black ring-1 ring-slate-200">
                {score}
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
