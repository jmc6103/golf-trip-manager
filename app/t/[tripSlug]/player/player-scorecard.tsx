'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { maxScoreForHole } from '@/lib/scoring'
import { leaveTrip } from '@/app/actions'

type GroupMember = {
  player: { id: string; name: string; handicap: number }
  scores: Record<number, number | undefined>
  submittedAt: string | null
}

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
  submittedAt?: string | null
  teamScoring: boolean
  groupScorekeeping: {
    id: string
    groupNumber: number
    scorekeeperPlayerId: string | null
    isScorekeeper: boolean
    members: GroupMember[]
  } | null
}

type PendingScore = {
  id: string
  roundId: string
  playerId: string
  holeNumber: number
  gross: number | null
  endpoint: 'score' | 'group-score'
  createdAt: string
}

const minSwipeDistance = 50

export function PlayerScorecard({ slug }: { slug: string }) {
  const [data, setData] = useState<PlayerCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingHole, setSavingHole] = useState<number | null>(null)
  const [activeHoleIndex, setActiveHoleIndex] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [eventCursor, setEventCursor] = useState(() => new Date().toISOString())
  const [toast, setToast] = useState('')
  const [pendingScores, setPendingScores] = useState<PendingScore[]>([])
  const [scoreMode, setScoreMode] = useState<'mine' | 'group'>('mine')
  const [selectedGroupPlayerId, setSelectedGroupPlayerId] = useState<string | null>(null)
  const queueKey = `gtm-pending-scores:${slug}`

  function readQueue() {
    if (typeof window === 'undefined') return []
    try {
      const parsed = JSON.parse(window.localStorage.getItem(queueKey) ?? '[]')
      return Array.isArray(parsed) ? parsed as PendingScore[] : []
    } catch {
      return []
    }
  }

  function writeQueue(items: PendingScore[]) {
    setPendingScores(items)
    if (typeof window !== 'undefined') window.localStorage.setItem(queueKey, JSON.stringify(items))
  }

  function applyPendingScores(card: PlayerCard, items = pendingScores) {
    let next = card
    for (const item of items.filter((entry) => entry.roundId === card.round.id)) {
      next = applyLocalScore(next, item.playerId, item.holeNumber, item.gross)
    }
    return next
  }

  async function load(quiet = false, queue = pendingScores) {
    if (!quiet) setLoading(true)
    const res = await fetch(`/t/${slug}/api/player-card`, { cache: 'no-store' })
    if (res.ok) setData(applyPendingScores(await res.json(), queue))
    else setData(null)
    if (!quiet) setLoading(false)
  }

  useEffect(() => {
    const initialQueue = readQueue()
    setPendingScores(initialQueue)
    void load(false, initialQueue)
    const timer = setInterval(() => pollEvents(), 5000)
    const flushTimer = setInterval(() => flushPendingScores(), 7000)
    window.addEventListener('online', flushPendingScores)
    return () => {
      clearInterval(timer)
      clearInterval(flushTimer)
      window.removeEventListener('online', flushPendingScores)
    }
  }, [slug, eventCursor])

  useEffect(() => {
    if (!data?.groupScorekeeping) return
    setSelectedGroupPlayerId((current) => current ?? data.player.id)
    if (!data.groupScorekeeping.isScorekeeper) setScoreMode('mine')
  }, [data])

  async function pollEvents() {
    const res = await fetch(`/t/${slug}/api/events?since=${encodeURIComponent(eventCursor)}`, { cache: 'no-store' }).catch(() => null)
    if (!res?.ok) {
      await load(true)
      return
    }
    const events: Array<{ type: string; createdAt: string; payload: unknown }> = await res.json()
    if (!events.length) return
    setEventCursor(events[events.length - 1].createdAt)
    setToast(formatEvent(events[events.length - 1]))
    setTimeout(() => setToast(''), 4000)
    await load(true)
  }

  async function submitScore(playerId: string, holeNumber: number, gross: number) {
    if (!data) return
    const isGroupScore = scoreMode === 'group' && data.groupScorekeeping?.isScorekeeper && playerId !== data.player.id
    const currentScore = getScoreForPlayer(data, playerId, holeNumber)
    const nextGross = !isGroupScore && currentScore === gross ? null : gross
    const pending: PendingScore = {
      id: `${Date.now()}-${playerId}-${holeNumber}`,
      roundId: data.round.id,
      playerId,
      holeNumber,
      gross: nextGross,
      endpoint: isGroupScore ? 'group-score' : 'score',
      createdAt: new Date().toISOString(),
    }

    setSavingHole(holeNumber)
    setMessage('')
    setData((current) => current ? applyLocalScore(current, playerId, holeNumber, nextGross) : current)

    const ok = await sendPendingScore(pending)
    if (ok) {
      void load(true)
    } else {
      writeQueue([...readQueue().filter((item) => item.id !== pending.id), pending])
      setMessage('Saved on this device. It will sync when signal comes back.')
    }
    setSavingHole(null)
  }

  async function sendPendingScore(item: PendingScore) {
    try {
      const res = await fetch(`/t/${slug}/api/${item.endpoint}`, {
        method: item.gross == null ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId: item.roundId, playerId: item.playerId, holeNumber: item.holeNumber, gross: item.gross }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setMessage(json?.error ?? 'Could not sync score.')
      }
      return res.ok
    } catch {
      return false
    }
  }

  async function flushPendingScores() {
    const queue = readQueue()
    if (!queue.length) return
    const remaining: PendingScore[] = []
    for (const item of queue) {
      const ok = await sendPendingScore(item)
      if (!ok) remaining.push(item)
    }
    writeQueue(remaining)
    if (queue.length !== remaining.length) await load(true)
    if (!remaining.length) setMessage('')
  }

  async function chooseScorekeeper(playerId: string | null) {
    if (!data) return
    const res = await fetch(`/t/${slug}/api/group-scorekeeper`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId: data.round.id, scorekeeperPlayerId: playerId }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      setMessage(json?.error ?? 'Could not update scorekeeper.')
      return
    }
    await load(true)
  }

  async function submitGroup() {
    if (!data) return
    await flushPendingScores()
    const res = await fetch(`/t/${slug}/api/group-submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId: data.round.id }),
    })
    const json = await res.json().catch(() => null)
    setMessage(res.ok ? 'Group card submitted.' : json?.error ?? 'Could not submit group.')
    await load(true)
  }

  const activeTargetId = scoreMode === 'group' && data?.groupScorekeeping?.isScorekeeper
    ? selectedGroupPlayerId ?? data.player.id
    : data?.player.id ?? ''
  const activeTarget = data?.groupScorekeeping?.members.find((member) => member.player.id === activeTargetId)?.player ?? data?.player
  const activeScores = data ? getScoresForPlayer(data, activeTargetId) : {}

  const totals = useMemo(() => {
    const scores = Object.values(activeScores).filter((score): score is number => score != null)
    return { holes: scores.length, gross: scores.reduce((sum, score) => sum + score, 0) }
  }, [activeScores])

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
  const activePending = pendingScores.some((item) => item.roundId === data.round.id && item.playerId === activeTargetId && item.holeNumber === activeHole.holeNumber)

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
              <p className="mt-2 text-sm text-slate-300">{data.round.formatLabel} - holes stay loaded while scores sync</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-emerald-200">
                {data.player.teamName ?? 'No team'} - {data.player.name}
              </p>
              <form action={leaveTrip} className="mt-2">
                <input type="hidden" name="slug" value={slug} />
                <button type="submit" className="text-xs font-bold text-slate-400 underline underline-offset-2">Not you?</button>
              </form>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2 text-right">
              <p className="text-xs text-slate-300">{activeTarget?.name === data.player.name ? 'Gross' : activeTarget?.name}</p>
              <p className="text-xl font-black">{totals.holes ? totals.gross : '-'}</p>
            </div>
          </div>
        </section>
        {toast ? <section className="rounded-[22px] bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow-sm">{toast}</section> : null}

        {data.matchTimeline ? <MatchTracker timeline={data.matchTimeline} /> : null}

        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoTile label={data.teamScoring ? 'Scoring For' : 'Partner'} value={data.teamScoring ? data.player.teamName ?? 'Team' : data.partner?.name ?? 'Solo'} />
            <InfoTile label={data.teamScoring ? 'Against' : 'Opponents'} value={data.teamScoring ? 'Field' : data.opponents.map((item) => item.name).join(' / ') || 'TBD'} />
          </div>
          <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900 ring-1 ring-emerald-100">
            {pendingScores.length ? `${pendingScores.length} score(s) waiting for signal. You can keep moving hole to hole.` : 'Score taps update the card instantly and sync in the background.'}
          </div>
        </section>

        {data.groupScorekeeping ? (
          <GroupScorekeepingPanel
            group={data.groupScorekeeping}
            currentPlayerId={data.player.id}
            mode={scoreMode}
            selectedPlayerId={activeTargetId}
            onMode={setScoreMode}
            onSelectPlayer={setSelectedGroupPlayerId}
            onChooseScorekeeper={chooseScorekeeper}
            onSubmit={submitGroup}
          />
        ) : null}

        <HoleScoreCard
          hole={activeHole}
          holeIndex={activeHoleIndex}
          totalHoles={totalHoles}
          targetName={activeTarget?.name ?? data.player.name}
          maxScore={maxScoreForHole(activeHole.par, data.trip.scoreMax)}
          savedScore={activeScores[activeHole.holeNumber]}
          pending={activePending}
          saving={savingHole === activeHole.holeNumber}
          strokeInfo={data.strokeSummary[activeHole.holeNumber]}
          onScore={(score) => submitScore(activeTargetId, activeHole.holeNumber, score)}
          onPrevious={() => goToHole(activeHoleIndex - 1)}
          onNext={() => goToHole(activeHoleIndex + 1)}
          onTouchStart={(x) => setTouchStartX(x)}
          onTouchEnd={handleTouchEnd}
        />

        <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-center text-sm font-bold text-slate-500">
            {isComplete ? 'All holes entered.' : `${totalHoles - totals.holes} hole(s) left for ${activeTarget?.name ?? 'player'}.`}
          </p>
          {message ? <p className="mt-2 text-center text-sm font-bold text-rose-700">{message}</p> : null}
        </section>

        <BottomNav slug={slug} active="player" />
      </div>
    </main>
  )
}

function applyLocalScore(card: PlayerCard, playerId: string, holeNumber: number, gross: number | null): PlayerCard {
  const patchScores = (scores: Record<number, number | undefined>) => {
    const next = { ...scores }
    if (gross == null) delete next[holeNumber]
    else next[holeNumber] = gross
    return next
  }
  return {
    ...card,
    myScores: playerId === card.player.id ? patchScores(card.myScores) : card.myScores,
    groupScorekeeping: card.groupScorekeeping
      ? {
          ...card.groupScorekeeping,
          members: card.groupScorekeeping.members.map((member) =>
            member.player.id === playerId ? { ...member, scores: patchScores(member.scores) } : member
          ),
        }
      : card.groupScorekeeping,
  }
}

function getScoresForPlayer(card: PlayerCard, playerId: string) {
  if (playerId === card.player.id) return card.myScores
  return card.groupScorekeeping?.members.find((member) => member.player.id === playerId)?.scores ?? {}
}

function getScoreForPlayer(card: PlayerCard, playerId: string, holeNumber: number) {
  return getScoresForPlayer(card, playerId)[holeNumber]
}

function formatEvent(event: { type: string; payload: unknown }) {
  const payload = event.payload && typeof event.payload === 'object' ? event.payload as Record<string, unknown> : {}
  if (typeof payload.title === 'string') return payload.title
  if (event.type === 'ROUND_STARTED') return 'Round started.'
  if (event.type === 'ROUND_FINAL') return 'Round finalized.'
  if (event.type === 'MATCH_STATUS') return typeof payload.status === 'string' ? payload.status : 'Match status changed.'
  return 'Trip update posted.'
}

function Shell({ children }: { children: ReactNode }) {
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

function GroupScorekeepingPanel({
  group,
  currentPlayerId,
  mode,
  selectedPlayerId,
  onMode,
  onSelectPlayer,
  onChooseScorekeeper,
  onSubmit,
}: {
  group: NonNullable<PlayerCard['groupScorekeeping']>
  currentPlayerId: string
  mode: 'mine' | 'group'
  selectedPlayerId: string
  onMode: (mode: 'mine' | 'group') => void
  onSelectPlayer: (playerId: string) => void
  onChooseScorekeeper: (playerId: string | null) => void
  onSubmit: () => void
}) {
  return (
    <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Group {group.groupNumber}</p>
          <h2 className="text-lg font-black">{group.isScorekeeper ? 'Group Scorekeeping' : 'Scorekeeper'}</h2>
        </div>
        <button onClick={onSubmit} disabled={!group.isScorekeeper} className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:bg-slate-200 disabled:text-slate-500">
          Submit
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {group.members.map((member) => {
          const selected = group.scorekeeperPlayerId === member.player.id
          return (
            <button key={member.player.id} onClick={() => onChooseScorekeeper(member.player.id)} className={`rounded-2xl px-3 py-3 text-left ring-1 ${selected ? 'bg-emerald-50 text-emerald-950 ring-emerald-200' : 'bg-slate-50 text-slate-700 ring-slate-200'}`}>
              <p className="truncate text-sm font-black">{member.player.name}</p>
              <p className="text-xs font-bold">{selected ? 'Scorekeeper' : `${Object.keys(member.scores).length} holes`}</p>
            </button>
          )
        })}
      </div>
      {group.isScorekeeper ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
            <button onClick={() => onMode('mine')} className={`rounded-xl px-3 py-2 text-sm font-black ${mode === 'mine' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>My Card</button>
            <button onClick={() => onMode('group')} className={`rounded-xl px-3 py-2 text-sm font-black ${mode === 'group' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Group Card</button>
          </div>
          {mode === 'group' ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {group.members.map((member) => (
                <button key={member.player.id} onClick={() => onSelectPlayer(member.player.id)} className={`shrink-0 rounded-full px-3 py-2 text-sm font-black ${selectedPlayerId === member.player.id ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {member.player.id === currentPlayerId ? 'Me' : member.player.name}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-500">
          {group.scorekeeperPlayerId ? 'Your selected scorekeeper can enter the full group card.' : 'Tap a group member to choose the scorekeeper.'}
        </p>
      )}
    </section>
  )
}

function HoleScoreCard({
  hole,
  holeIndex,
  totalHoles,
  targetName,
  maxScore,
  savedScore,
  pending,
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
  targetName: string
  maxScore: number
  savedScore: number | undefined
  pending: boolean
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
          <p className="text-sm font-semibold text-slate-500">{targetName} - Par {hole.par} - SI {hole.strokeIndex}</p>
        </div>
        <button onClick={onNext} disabled={holeIndex === totalHoles - 1} className="h-11 w-11 rounded-full bg-slate-100 text-xl font-black text-slate-700 disabled:text-slate-300" aria-label="Next hole">
          {'>'}
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{strokeInfo?.label ?? 'No strokes'}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Saved {savedScore ?? '-'}</span>
        {pending ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Pending sync</span> : null}
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
