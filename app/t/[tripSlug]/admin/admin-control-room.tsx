'use client'

import { useState, useTransition } from 'react'

type AdminTrip = {
  slug: string
  teamMethod: string
  pairingMethod: string
  players: Array<{ id: string; name: string; handicap: number | null }>
  teams: Array<{ id: string; name: string; players: Array<{ playerId: string; player: { id: string; name: string; handicap: number | null } }> }>
  rounds: Array<{
    id: string
    roundNumber: number
    format: string
    status: string
    matches: Array<{
      id: string
      matchNumber: number
      sides: Array<{ id: string; label: string | null; team: { name: string } | null; players: Array<{ playerId: string; player: { id: string; name: string } }> }>
    }>
  }>
}

export function AdminControlRoom({ trip, canAdmin }: { trip: AdminTrip; canAdmin: boolean }) {
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  async function mutate(body: unknown, method = 'POST') {
    setMessage('')
    startTransition(async () => {
      const res = await fetch(`/t/${trip.slug}/api/admin/ops`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      setMessage(res.ok ? 'Saved.' : json?.error ?? 'Update failed.')
      if (res.ok) window.location.reload()
    })
  }

  if (!canAdmin) return null

  return (
    <section className="space-y-4">
      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title="Trip Control Room" />
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Generate teams, manage manual assignments, create matches, and control live scoring.
        </p>
        {message ? <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => mutate({ action: 'generate-teams' })} disabled={isPending} className="rounded-2xl bg-slate-950 px-4 py-4 font-black text-white disabled:opacity-60">Generate Teams</button>
          <button onClick={() => mutate({ action: 'generate-matches' })} disabled={isPending} className="rounded-2xl bg-indigo-600 px-4 py-4 font-black text-white disabled:opacity-60">Generate Matches</button>
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title={trip.teamMethod === 'MANUAL' ? 'Manual Team Selection' : 'Teams'} />
        <div className="mt-3 space-y-3">
          {trip.players.map((player) => {
            const currentTeam = trip.teams.find((team) => team.players.some((entry) => entry.playerId === player.id))
            return (
              <div key={player.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl bg-slate-50 p-3">
                <div>
                  <p className="font-black">{player.name}</p>
                  <p className="text-sm font-semibold text-slate-500">HCP {player.handicap ?? 0}</p>
                </div>
                <select
                  value={currentTeam?.id ?? ''}
                  onChange={(event) => mutate({ type: 'team-assignment', playerId: player.id, teamId: event.target.value }, 'PATCH')}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                >
                  <option value="">None</option>
                  {trip.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title="Round Controls" />
        <div className="mt-3 space-y-3">
          {trip.rounds.map((round) => (
            <div key={round.id} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="font-black">Round {round.roundNumber} - {round.format.replace(/_/g, ' ')}</p>
              <p className="text-sm font-semibold text-slate-500">{round.status.replace(/_/g, ' ')}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button onClick={() => mutate({ action: 'start-round', roundId: round.id })} className="rounded-xl bg-emerald-600 px-3 py-3 text-sm font-black text-white">Start</button>
                <button onClick={() => mutate({ action: 'finalize-round', roundId: round.id })} className="rounded-xl bg-amber-500 px-3 py-3 text-sm font-black text-white">Final</button>
                <button onClick={() => mutate({ action: 'reset-round', roundId: round.id })} className="rounded-xl bg-red-50 px-3 py-3 text-sm font-black text-red-700">Reset</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title={trip.pairingMethod === 'MANUAL' ? 'Manual Pairings / Matches' : 'Pairings / Matches'} />
        <div className="mt-3 space-y-3">
          {trip.rounds.flatMap((round) => round.matches.map((match) => (
            <div key={match.id} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="text-sm font-black">Round {round.roundNumber} - Match {match.matchNumber}</p>
              <div className="mt-2 space-y-2">
                {match.sides.map((side) => (
                  <ManualSide key={side.id} side={side} players={trip.players} onSave={(playerIds) => mutate({ type: 'match-side', sideId: side.id, playerIds }, 'PATCH')} />
                ))}
              </div>
            </div>
          )))}
          {!trip.rounds.some((round) => round.matches.length) ? (
            <p className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-500">Generate matches to edit manual pairings.</p>
          ) : null}
        </div>
      </section>
    </section>
  )
}

function ManualSide({
  side,
  players,
  onSave,
}: {
  side: AdminTrip['rounds'][number]['matches'][number]['sides'][number]
  players: AdminTrip['players']
  onSave: (playerIds: string[]) => void
}) {
  const [value, setValue] = useState(side.players.map((entry) => entry.playerId).join(','))
  const selected = value.split(',').filter(Boolean)

  function setAt(index: number, playerId: string) {
    const next = [...selected]
    next[index] = playerId
    setValue(next.filter(Boolean).join(','))
  }

  return (
    <div className="rounded-xl bg-white p-2 ring-1 ring-slate-200">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{side.team?.name ?? side.label ?? 'Side'}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((index) => (
          <select key={index} value={selected[index] ?? ''} onChange={(event) => setAt(index, event.target.value)} className="min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold">
            <option value="">TBD</option>
            {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
          </select>
        ))}
      </div>
      <button onClick={() => onSave(selected)} className="mt-2 w-full rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">Save Side</button>
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">{title}</h2>
}
