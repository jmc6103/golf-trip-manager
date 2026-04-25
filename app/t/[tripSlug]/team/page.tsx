import { notFound } from 'next/navigation'
import { formatLabel, getTripDetail } from '@/lib/tenant-data'

export default async function TeamPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = await getTripDetail(tripSlug)
  if (!trip) notFound()
  const teamScores = trip.teams.map((team) => ({
    id: team.id,
    name: team.name,
    points: team.sides.reduce((total, side) => total + side.points, 0),
  }))
  const first = teamScores[0] ?? { name: 'Team One', points: 0 }
  const second = teamScores[1] ?? { name: 'Team Two', points: 0 }

  return (
    <main className="min-h-screen px-4 py-5 text-slate-950">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Live Team Board</p>
          <h1 className="mt-2 text-3xl font-black">{teamScores.length ? `${first.name} leads` : 'Teams pending'}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-300">{trip.name}</p>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Score label={first.name} value={String(first.points)} />
            <span className="text-sm font-black text-slate-400">VS</span>
            <Score label={second.name} value={String(second.points)} />
          </div>
        </section>
        {trip.rounds.map((round) => (
          <section key={round.id} className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Round {round.roundNumber} - {round.status.replace(/_/g, ' ')}</p>
            <h2 className="mt-1 text-xl font-black">{formatLabel(round.format)}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{round.course?.name ?? 'Course pending'} - {round.matches.length} matches</p>
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
