import { notFound } from 'next/navigation'
import { formatLabel, getTripDetail } from '@/lib/tenant-data'

export default async function FormatPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = await getTripDetail(tripSlug)
  if (!trip) notFound()

  return (
    <main className="min-h-screen px-4 py-5 text-slate-950">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Format Guide</p>
          <h1 className="mt-2 text-3xl font-black">{trip.name}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-300">Trip-specific scoring rules and casual local rules live here.</p>
        </section>
        {trip.rounds.map((round) => (
          <section key={round.id} className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Round {round.roundNumber}</p>
            <h2 className="mt-1 text-xl font-black">{formatLabel(round.format)}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {round.handicapAllowance}% handicap allowance - {round.pointsAvailable} point{round.pointsAvailable === 1 ? '' : 's'} available - {trip.scoreMax.replace(/_/g, ' ').toLowerCase()}.
            </p>
          </section>
        ))}
      </div>
    </main>
  )
}
