import Link from 'next/link'
import { CreateTripForm } from './create-trip-form'
import { listTripSummaries } from '@/lib/tenant-data'

export default async function HomePage() {
  const trips = await listTripSummaries()

  return (
    <main className="min-h-screen px-4 py-5 text-slate-950">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Golf Trip Manager</p>
          <h1 className="mt-2 text-3xl font-black">Launch a private golf trip</h1>
          <p className="mt-2 text-sm font-semibold text-slate-300">
            Create a trip, share a link, and give every group a lightweight scoring experience in the browser.
          </p>
        </section>

        <section className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">How It Works</h2>
          <div className="mt-3 space-y-2 text-sm font-semibold text-slate-600">
            <p>1. The trip admin creates the trip and claims ownership.</p>
            <p>2. The app creates a private trip URL and invite links.</p>
            <p>3. Players join through the trip URL.</p>
            <p>4. Scores, matches, and rules stay organized inside that trip.</p>
          </div>
        </section>

        <CreateTripForm />

        {trips.length ? (
          <section className="space-y-3">
            <h2 className="px-1 text-sm font-black uppercase tracking-wide text-slate-500">Your Trips</h2>
            {trips.map((trip) => (
              <Link key={trip.slug} href={`/t/${trip.slug}`} className="block rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">{trip.location}</p>
                <h3 className="mt-1 text-xl font-black">{trip.name}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {trip.dates} - {trip.playerCount}/{trip.maxPlayers} players
                </p>
              </Link>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  )
}
