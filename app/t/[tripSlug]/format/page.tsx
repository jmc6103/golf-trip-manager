import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatLabel, getTripDetail } from '@/lib/tenant-data'

export default async function FormatPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = await getTripDetail(tripSlug)
  if (!trip) notFound()

  return (
    <main className="min-h-screen bg-[#f6f7f3] px-4 py-4 pb-24 text-slate-950">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-[30px] bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Trip Format</p>
          <h1 className="mt-2 text-3xl font-black">How scoring works</h1>
          <p className="mt-2 text-sm text-slate-300">
            {trip.name} uses {trip.rulesMode.toLowerCase()} rules with {trip.scoreMax.replace(/_/g, ' ').toLowerCase()} score caps.
          </p>
        </section>

        <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <SectionTitle title="Handicap Basics" />
          <div className="mt-3 space-y-3 text-sm font-semibold text-slate-600">
            <p>Strokes are assigned by hole stroke index. Stroke index 1 is the hardest hole, then 2, then 3, and so on.</p>
            <p>In match play, the lowest handicap player in the match plays off zero. Other players receive strokes relative to that player after the format allowance is applied.</p>
            <p>For scramble and other team formats, the live board uses team names and team-side scoring instead of individual head-to-head labels.</p>
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle title="Chosen Rounds" />
          {trip.rounds.map((round) => (
            <article key={round.id} className="rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Round {round.roundNumber} - {round.status.replace(/_/g, ' ')}</p>
              <h2 className="mt-1 text-xl font-black">{formatLabel(round.format)}</h2>
              <p className="mt-2 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-900 ring-1 ring-emerald-100">
                {round.handicapAllowance}% allowance - {round.pointsAvailable} point{round.pointsAvailable === 1 ? '' : 's'} per match
              </p>
              <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-600">
                {formatDetails(round.format).map((detail) => (
                  <li key={detail} className="rounded-2xl bg-slate-50 px-3 py-2">{detail}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <BottomNav slug={trip.slug} active="format" />
      </div>
    </main>
  )
}

function formatDetails(format: string) {
  if (format === 'FOUR_BALL') {
    return [
      'Each player plays their own ball.',
      'On each hole, each side uses the better net score from its two players.',
      'The lower better-ball net score wins the hole.',
      'A match is worth 1 point. A halved match is worth 0.5 points per side.',
    ]
  }
  if (format === 'SINGLES') {
    return [
      'One player plays one opponent head to head.',
      'The lower handicap player plays off zero.',
      'The higher handicap player receives the difference on the hardest holes.',
      'Each match is worth 1 point. A halved match is worth 0.5 points per side.',
    ]
  }
  if (format === 'SCRAMBLE') {
    return [
      'Each team chooses its best shot and everyone plays from that spot.',
      'Scores are entered and displayed by team name.',
      'The live board ranks teams by gross team score and match points where pairings exist.',
      'This format supports many teams in one shared round.',
    ]
  }
  if (format === 'SHAMBLE') {
    return [
      'Each team chooses the best drive, then players finish their own ball.',
      'The team side uses the best net score available on each hole.',
      'Scores can be shown by team name while still accepting player-entered hole scores.',
    ]
  }
  if (format === 'STABLEFORD') {
    return [
      'Players earn points per hole instead of counting only total strokes.',
      'The live board rolls player points into team totals.',
      'This is best for larger groups where every hole should stay meaningful.',
    ]
  }
  return [
    'Everyone posts a full round score.',
    'Gross and net leaderboards update as scores are entered.',
    'Blind or manual matchups can be revealed from the team board when configured.',
  ]
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="px-1 text-sm font-black uppercase tracking-wide text-slate-500">{title}</h2>
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
