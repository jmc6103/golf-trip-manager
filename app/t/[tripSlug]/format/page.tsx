import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatLabel, getTripDetail } from '@/lib/tenant-data'
import { FormatClient } from './format-client'

export default async function FormatPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = await getTripDetail(tripSlug)
  if (!trip) notFound()

  const rounds = trip.rounds.map((round) => ({
    id: round.id,
    roundNumber: round.roundNumber,
    format: round.format,
    formatLabel: formatLabel(round.format),
    handicapAllowance: round.handicapAllowance,
    status: round.status,
    course: trip.courses.find((c) => c.id === round.courseId) ?? null,
  }))

  return (
    <main className="min-h-screen bg-[#f6f7f3] px-4 py-4 pb-24 text-slate-950">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-[30px] bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Trip Format</p>
          <h1 className="mt-2 text-3xl font-black">How scoring works</h1>
          <p className="mt-2 text-sm text-slate-300">
            {trip.name} · {trip.rulesMode.toLowerCase()} rules · {trip.scoreMax.replace(/_/g, ' ').toLowerCase()} max
          </p>
        </section>

        <FormatClient rounds={rounds} tripName={trip.name} />

        <BottomNav slug={trip.slug} active="format" />
      </div>
    </main>
  )
}

function BottomNav({ slug, active }: { slug: string; active: 'team' | 'player' | 'lobby' | 'format' }) {
  const items = [
    { href: `/t/${slug}/team`, label: 'Team', key: 'team' },
    { href: `/t/${slug}/player`, label: 'Player', key: 'player' },
    { href: `/t/${slug}/format`, label: 'Format', key: 'format' },
    { href: `/t/${slug}/lobby`, label: 'Lobby', key: 'lobby' },
  ] as const
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-2 px-4 py-3 text-sm font-bold">
        {items.map((item) => <Link key={item.key} href={item.href} className={`rounded-2xl px-3 py-3 text-center ${active === item.key ? 'bg-slate-950 text-white' : 'text-slate-600'}`}>{item.label}</Link>)}
      </div>
    </nav>
  )
}
