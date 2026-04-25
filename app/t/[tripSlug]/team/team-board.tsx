'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type TeamBoardData = {
  trip: { slug: string; name: string; status: string }
  teams: Array<{ id: string; name: string; points: number; handicapTotal: number; players: Array<{ id: string; name: string; handicap: number }> }>
  selectedRound: any
  rounds: Array<{ id: string; roundNumber: number; formatLabel: string; status: string }>
}

export function TeamBoard({ slug }: { slug: string }) {
  const [data, setData] = useState<TeamBoardData | null>(null)
  const [round, setRound] = useState<number | null>(null)
  const [error, setError] = useState('')

  async function load(quiet = false) {
    const query = round ? `?round=${round}` : ''
    const res = await fetch(`/t/${slug}/api/team-view${query}`, { cache: 'no-store' })
    if (res.ok) {
      setData(await res.json())
      setError('')
    } else if (!quiet) {
      setError('Team board is unavailable right now.')
    }
  }

  useEffect(() => {
    void load()
    const timer = setInterval(() => load(true), 4000)
    return () => clearInterval(timer)
  }, [slug, round])

  if (!data) {
    return (
      <main className="min-h-screen bg-[#f6f7f3] px-4 py-4 text-slate-950">
        <div className="mx-auto max-w-md rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">{error || 'Loading team board...'}</div>
      </main>
    )
  }

  const leader = getLeader(data.teams)

  return (
    <main className="min-h-screen bg-[#f6f7f3] px-4 py-4 pb-24 text-slate-950">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-[30px] bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Live Team Board</p>
          <h1 className="mt-2 text-3xl font-black">{leader}</h1>
          <p className="mt-1 text-sm text-slate-300">{data.trip.name}</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {data.teams.slice(0, 4).map((team) => <ScorePanel key={team.id} label={team.name} value={team.points} />)}
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2 rounded-[24px] bg-white p-2 shadow-sm ring-1 ring-slate-200">
          {data.rounds.map((item) => (
            <button key={item.id} onClick={() => setRound(item.roundNumber)} className={`rounded-2xl px-2 py-3 text-center text-sm font-black ${data.selectedRound?.id === item.id ? 'bg-slate-950 text-white' : 'text-slate-600'}`}>
              R{item.roundNumber}
            </button>
          ))}
        </section>

        {data.selectedRound ? (
          <>
            <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Round {data.selectedRound.roundNumber} - {data.selectedRound.status.replace(/_/g, ' ')}</p>
              <h2 className="mt-1 text-xl font-black">{data.selectedRound.formatLabel}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">{data.selectedRound.course?.name ?? 'Course pending'}</p>
            </section>

            {data.selectedRound.matchCards.length ? (
              <section className="space-y-3">
                <SectionTitle title={data.selectedRound.teamScoring ? 'Team Matches' : 'Live Matches'} />
                {data.selectedRound.matchCards.map((match: any) => <MatchCard key={match.id} match={match} />)}
              </section>
            ) : (
              <Leaderboard rows={data.selectedRound.leaderboard} />
            )}
          </>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          {data.teams.map((team) => <RosterCard key={team.id} team={team} />)}
        </div>

        <BottomNav slug={data.trip.slug} active="team" />
      </div>
    </main>
  )
}

function getLeader(teams: Array<{ name: string; points: number }>) {
  if (!teams.length) return 'Teams pending'
  const sorted = [...teams].sort((a, b) => b.points - a.points)
  if (sorted.length > 1 && sorted[0].points === sorted[1].points) return 'All square'
  return `${sorted[0].name} leads`
}

function ScorePanel({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-white/10 p-4 text-center ring-1 ring-white/15">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-300">{label}</p>
      <p className="mt-1 text-4xl font-black">{Number.isInteger(value) ? value : value.toFixed(1)}</p>
    </div>
  )
}

function MatchCard({ match }: { match: any }) {
  return (
    <article className="rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Match {match.matchNumber}</p>
          <h2 className="mt-1 text-xl font-black">{match.status.label}</h2>
        </div>
        <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right text-xs font-bold text-slate-600">{match.status.completedHoles}/18</div>
      </div>
      <div className="mt-4 space-y-2">
        {match.sides.map((side: any) => (
          <div key={side.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3">
            <div className="min-w-0">
              <p className="truncate font-black">{side.label}</p>
              <p className="truncate text-sm font-semibold text-slate-500">{side.players.map((player: any) => player.name).join(' / ') || 'TBD'}</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-black ring-1 ring-slate-200">{Number.isInteger(side.points) ? side.points : side.points.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </article>
  )
}

function Leaderboard({ rows }: { rows: any[] }) {
  return (
    <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <SectionTitle title="Leaderboard" />
      <div className="mt-3 space-y-2">
        {rows.length ? rows.map((row, index) => (
          <div key={row.player.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3">
            <span className="w-7 text-center text-sm font-black text-slate-500">{index + 1}</span>
            <div className="min-w-0">
              <p className="truncate font-black">{row.player.name}</p>
              <p className="text-sm text-slate-500">{row.holesPlayed} holes</p>
            </div>
            <p className="text-xl font-black">{row.gross ?? '-'}</p>
          </div>
        )) : <p className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-500">No scores yet.</p>}
      </div>
    </section>
  )
}

function RosterCard({ team }: { team: TeamBoardData['teams'][number] }) {
  return (
    <section className="rounded-[26px] bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between px-1 pb-2">
        <h2 className="font-black">{team.name}</h2>
        <p className="text-xs font-bold text-slate-500">Hdcp {team.handicapTotal}</p>
      </div>
      <div className="space-y-2">
        {team.players.map((player) => (
          <div key={player.id} className="rounded-2xl bg-slate-50 px-3 py-2">
            <p className="truncate text-sm font-bold">{player.name}</p>
            <p className="text-xs text-slate-500">{player.handicap}</p>
          </div>
        ))}
      </div>
    </section>
  )
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
