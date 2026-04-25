import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatLabel, getPlayerFromCookie, getTripDetail } from '@/lib/tenant-data'

export default async function PlayerPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = await getTripDetail(tripSlug)
  if (!trip) notFound()
  const player = await getPlayerFromCookie(tripSlug)
  const currentRound = trip.rounds.find((round) => round.status === 'LIVE') ?? trip.rounds[0]

  return (
    <main className="min-h-screen px-4 py-5 text-slate-950">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Player Card</p>
          <h1 className="mt-2 text-3xl font-black">{trip.name}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-300">
            {player ? `${player.name}${player.handicap == null ? '' : ` - HCP ${player.handicap}`}` : 'Join this trip to claim your player card.'}
          </p>
        </section>
        {!player ? (
          <Link href={`/t/${trip.slug}/join`} className="block rounded-[24px] bg-white p-4 text-center font-black shadow-sm ring-1 ring-slate-200">
            Join Trip
          </Link>
        ) : null}
        <section className="sticky top-0 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">{currentRound ? `Round ${currentRound.roundNumber}` : 'Round'}</p>
          <h2 className="mt-1 text-xl font-black">{currentRound ? formatLabel(currentRound.format) : 'No rounds yet'}</h2>
        </section>
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">{currentRound?.course?.name ?? 'Course pending'}</p>
          <h2 className="mt-2 text-3xl font-black">Score Entry</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">{trip.scoreMax.replace(/_/g, ' ').toLowerCase()} - scoring API next</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((score) => (
              <button key={score} disabled={!player} className="min-h-14 rounded-2xl bg-slate-50 text-lg font-black ring-1 ring-slate-200 disabled:opacity-40">
                {score}
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
