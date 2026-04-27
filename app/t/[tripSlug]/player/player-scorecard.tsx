'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { maxScoreForHole } from '@/lib/scoring'

type PlayerCard = {
  trip: { slug: string; name: string; scoreMax: string }
  player: { id: string; name: string; handicap: number; teamName: string | null }
  partner: { id: string; name: string; handicap: number } | null
  opponents: Array<{ id: string; name: string; handicap: number }>
  round: { id: string; roundNumber: number; name: string; format: string; formatLabel: string; status: string }
  course: {
    name: string
    teeName: string | null
    rating: number | null
    slope: number | null
    holes: Array<{ holeNumber: number; par: number; strokeIndex: number; yardage?: number | null }>
  }
  myScores: Record<number, number | undefined>
  strokeSummary: Record<number, { gets: number; gives: number; label: string }>
  matchTimeline: {
    leader: string
    through: number
    holes: Array<{ holeNumber: number; completed: boolean; display: string; wonByPlayerSide: boolean | null }>
  } | null
  status: string
  teamScoring: boolean
}

const minSwipeDistance = 50

export function PlayerScorecard({ slug }: { slug: string }) {
  const [data, setData] = useState<PlayerCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingHole, setSavingHole] = useState<number | null>(null)
  const [activeHoleIndex, setActiveHoleIndex] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  async function load(quiet = false) {
    if (!quiet) setLoading(true)
    const res = await fetch(`/t/${slug}/api/player-card`, { cache: 'no-store' })
    if (res.ok) setData(await res.json())
    else setData(null)
    if (!quiet) setLoading(false)
  }

  useEffect(() => {
    void load()
    const timer = setInterval(() => load(true), 5000)
    return () => clearInterval(timer)
  }, [slug])

  async function submitScore(holeNumber: number, gross: number) {
    setSavingHole(holeNumber)
    setMessage('')
    const res = await fetch(`/t/${slug}/api/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holeNumber, gross }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) setMessage(json?.error ?? 'Could not save score.')
    await load(true)
    setSavingHole(null)
  }

  const totals = useMemo(() => {
    const scores = Object.values(data?.myScores ?? {}).filter((score): score is number => score != null)
    return { holes: scores.length, gross: scores.reduce((sum, score) => sum + score, 0) }
  }, [data])

  if (loading) return <Shell>Loading player card...</Shell>
  if (!data) {
    return (
      <Shell>
        <p className="font-bold">No player card found for this browser.</p>
        <Link href={`/t/${slug}/join`} className="mt-4 block rounded-2xl bg-slate-950 px-4 py-4 text-center font-black text-white">
          Join Trip
        </Link>
      </Shell>
    )
  }

  const totalHoles = data.course.holes.length
  const activeHole = data.course.holes[activeHoleIndex] ?? data.course.holes[0]
  const isComplete = totals.holes === totalHoles

  function goToHole(index: number) {
    setActiveHoleIndex(Math.max(0, Math.min(totalHoles - 1, index)))
  }

  function handleTouchEnd(endX: number) {
    if (touchStartX == null) return
    const delta = touchStartX - endX
    if (Math.abs(delta) >= minSwipeDistance) goToHole(activeHoleIndex + (delta > 0 ? 1 : -1))
    setTouchStartX(null)
  }

  return (
    <main className="min-h-screen bg-[#f6f7f3] px-4 py-4 pb-24 text-slate-950">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
            Round {data.round.roundNumber} - {data.course.name}
          </p>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black">{data.status}</h1>
              <p className="mt-2 text-sm text-slate-300">{data.round.formatLabel} - autosaves each tap</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-emerald-200">
                {data.player.teamName ?? 'No team'} - {data.player.name}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2 text-right">
              <p className="text-xs text-slate-300">Gross</p>
              <p className="text-xl font-black">{totals.holes ? totals.gross : '-'}</p>
            </div>
          </div>
        </section>

        {data.matchTimeline ? <MatchTracker timeline={data.matchTimeline} /> : null}

        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoTile label={data.teamScoring ? 'Scoring For' : 'Partner'} value={data.teamScoring ? data.player.teamName ?? 'Team' : data.partner?.name ?? 'Solo'} />
            <InfoTile label={data.teamScoring ? 'Against' : 'Opponents'} value={data.teamScoring ? 'Field' : data.opponents.map((item) => item.name).join(' / ') || 'TBD'} />
          </div>
          <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900 ring-1 ring-emerald-100">
            {data.teamScoring ? 'Enter your team score for each hole. The live board displays team names for this format.' : 'Score taps save immediately and feed the live team board.'}
          </div>
        </section>

        <HoleScoreCard
          hole={activeHole}
          holeIndex={activeHoleIndex}
          totalHoles={totalHoles}
          maxScore={maxScoreForHole(activeHole.par, data.trip.scoreMax)}
          savedScore={data.myScores[activeHole.holeNumber]}
          saving={savingHole === activeHole.holeNumber}
          strokeInfo={data.strokeSummary[activeHole.holeNumber]}
          onScore={(score) => submitScore(activeHole.holeNumber, score)}
          onPrevious={() => goToHole(activeHoleIndex - 1)}
          onNext={() => goToHole(activeHoleIndex + 1)}
          onTouchStart={(x) => setTouchStartX(x)}
          onTouchEnd={handleTouchEnd}
        />

        <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-center text-sm font-bold text-slate-500">
            {isComplete ? 'All holes entered.' : `${totalHoles - totals.holes} hole(s) left.`}
          </p>
          {message ? <p className="mt-2 text-center text-sm font-bold text-rose-700">{message}</p> : null}
        </section>

        <BottomNav slug={slug} active="player" />
      </div>
    </main>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f6f7f3] px-4 py-4 text-slate-950">
      <div className="mx-auto max-w-md rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">{children}</div>
    </main>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-black text-slate-950">{value}</p>
    </div>
  )
}

function MatchTracker({ timeline }: { timeline: NonNullable<PlayerCard['matchTimeline']> }) {
  return (
    <section className="sticky top-0 z-10 rounded-[22px] bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Live Match</p>
          <h2 className="text-lg font-black">{timeline.leader}</h2>
        </div>
        <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-black text-slate-700">Thru {timeline.through}</span>
      </div>
      <div className="mt-3 grid grid-cols-6 gap-1.5">
        {timeline.holes.map((hole) => (
          <div key={hole.holeNumber} className={`rounded-xl px-1 py-1.5 text-center ring-1 ${matchHoleClasses(hole)}`}>
            <p className="text-[10px] font-black uppercase leading-none opacity-70">H{hole.holeNumber}</p>
            <p className="mt-1 text-sm font-black">{hole.completed ? hole.display : '-'}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function HoleScoreCard({
  hole,
  holeIndex,
  totalHoles,
  maxScore,
  savedScore,
  saving,
  strokeInfo,
  onScore,
  onPrevious,
  onNext,
  onTouchStart,
  onTouchEnd,
}: {
  hole: PlayerCard['course']['holes'][number]
  holeIndex: number
  totalHoles: number
  maxScore: number
  savedScore: number | undefined
  saving: boolean
  strokeInfo: { gets: number; gives: number; label: string } | undefined
  onScore: (score: number) => void
  onPrevious: () => void
  onNext: () => void
  onTouchStart: (x: number) => void
  onTouchEnd: (x: number) => void
}) {
  const choices = Array.from({ length: maxScore }, (_, index) => index + 1)
  return (
    <section
      className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200"
      onTouchStart={(event) => onTouchStart(event.touches[0]?.clientX ?? 0)}
      onTouchEnd={(event) => onTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
    >
      <div className="flex items-center justify-between gap-3">
        <button onClick={onPrevious} disabled={holeIndex === 0} className="h-11 w-11 rounded-full bg-slate-100 text-xl font-black text-slate-700 disabled:text-slate-300" aria-label="Previous hole">
          {'<'}
        </button>
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Hole {holeIndex + 1} of {totalHoles}</p>
          <h2 className="mt-1 text-2xl font-black">Hole {hole.holeNumber}</h2>
          <p className="text-sm font-semibold text-slate-500">Par {hole.par} - SI {hole.strokeIndex}</p>
        </div>
        <button onClick={onNext} disabled={holeIndex === totalHoles - 1} className="h-11 w-11 rounded-full bg-slate-100 text-xl font-black text-slate-700 disabled:text-slate-300" aria-label="Next hole">
          {'>'}
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{strokeInfo?.label ?? 'No strokes'}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Saved {savedScore ?? '-'}</span>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {choices.map((score) => (
          <button key={score} onClick={() => onScore(score)} disabled={saving} className={`min-h-14 rounded-2xl text-lg font-black ${savedScore === score ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-950 ring-1 ring-slate-200'} disabled:opacity-60`}>
            {score}
          </button>
        ))}
      </div>
    </section>
  )
}

function matchHoleClasses(hole: NonNullable<PlayerCard['matchTimeline']>['holes'][number]) {
  if (!hole.completed) return 'bg-slate-50 text-slate-400 ring-slate-200'
  if (hole.wonByPlayerSide == null) return 'bg-slate-100 text-slate-700 ring-slate-200'
  if (hole.wonByPlayerSide) return 'bg-emerald-100 text-emerald-900 ring-emerald-200'
  return 'bg-rose-100 text-rose-900 ring-rose-200'
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
        {items.map((item) => (
          <Link key={item.key} href={item.href} className={`rounded-2xl px-3 py-3 text-center ${active === item.key ? 'bg-slate-950 text-white' : 'text-slate-600'}`}>{item.label}</Link>
        ))}
      </div>
    </nav>
  )
}
