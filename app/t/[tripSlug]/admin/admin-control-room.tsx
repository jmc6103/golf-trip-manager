'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

type AdminTrip = {
  slug: string
  inviteCode: string
  status: string
  maxPlayers: number
  teamMethod: string
  pairingMethod: string
  players: Array<{ id: string; name: string; handicap: number | null }>
  courses: Array<{ id: string; name: string; dayNumber: number }>
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
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  const readiness = getReadiness(trip)

  async function mutate(body: unknown, method = 'POST') {
    setMessage('')
    startTransition(async () => {
      const res = await fetch(`/t/${trip.slug}/api/admin/ops`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setMessage('Saved.')
        setTimeout(() => setMessage(''), 3000)
        router.refresh()
      } else {
        setMessage(json?.error ?? 'Update failed.')
      }
    })
  }

  if (!canAdmin) return null

  return (
    <section className="space-y-4">
      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title="Invite Players" />
        <div className="mt-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Player Invite Link</p>
          <p className="mt-1 break-all text-sm font-bold text-slate-950">
            {typeof window !== 'undefined' ? window.location.origin : ''}/t/{trip.slug}/join?code={trip.inviteCode}
          </p>
          <button
            onClick={() => {
              const url = `${window.location.origin}/t/${trip.slug}/join?code=${trip.inviteCode}`
              navigator.clipboard.writeText(url).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              })
            }}
            className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white active:opacity-80"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title="Trip Control Room" />
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Generate teams, manage manual assignments, create matches, and control live scoring.
        </p>
        {message ? <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p> : null}
        <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Next Action</p>
              <p className="mt-1 font-black text-slate-950">{readiness.nextAction}</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${readiness.ready ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {readiness.ready ? 'Ready' : 'Needs Work'}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <ReadinessStat label="Players" value={`${trip.players.length}/${trip.maxPlayers}`} ok={trip.players.length >= 2} />
            <ReadinessStat label="Teams" value={trip.teams.length ? String(trip.teams.length) : 'None'} ok={trip.teams.length > 0} />
            <ReadinessStat label="Matches" value={String(readiness.matchCount)} ok={readiness.matchCount > 0} />
            <ReadinessStat label="Live Round" value={readiness.liveRoundLabel} ok={Boolean(readiness.liveRoundLabel)} />
          </div>
          {readiness.issues.length ? (
            <div className="mt-3 space-y-2">
              {readiness.issues.map((issue) => (
                <p key={issue} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200">{issue}</p>
              ))}
            </div>
          ) : null}
        </div>
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
              <p className="font-black">Round {round.roundNumber} — {round.format.replace(/_/g, ' ')}</p>
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
              <p className="text-sm font-black">Round {round.roundNumber} — Match {match.matchNumber}</p>
              <div className="mt-2 space-y-2">
                {match.sides.map((side) => (
                  <ManualSide
                    key={side.id}
                    side={side}
                    players={trip.players}
                    format={round.format}
                    onSave={(playerIds) => mutate({ type: 'match-side', sideId: side.id, playerIds }, 'PATCH')}
                  />
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

function getReadiness(trip: AdminTrip) {
  const matchCount = trip.rounds.reduce((sum, round) => sum + round.matches.length, 0)
  const liveRound = trip.rounds.find((round) => round.status === 'LIVE')
  const issues: string[] = []

  if (trip.players.length < 2) issues.push('Invite at least two players.')
  if (trip.players.length < trip.maxPlayers) issues.push(`${trip.maxPlayers - trip.players.length} invite spot${trip.maxPlayers - trip.players.length === 1 ? '' : 's'} still open.`)
  if (!trip.courses.length) issues.push('Add at least one course before play starts.')
  if (!trip.teams.length) issues.push('Generate teams when the roster is close to final.')
  if (trip.teams.length && !matchCount) issues.push('Generate matches before starting a round.')
  if (matchCount && !liveRound) issues.push('Start a round when players are ready to score.')

  const nextAction =
    trip.players.length < 2 ? 'Share the invite link' :
    !trip.teams.length ? 'Generate teams' :
    !matchCount ? 'Generate matches' :
    !liveRound ? 'Start the first round' :
    `Monitor Round ${liveRound.roundNumber}`

  return {
    ready: trip.players.length >= 2 && trip.courses.length > 0 && trip.teams.length > 0 && matchCount > 0,
    nextAction,
    issues,
    matchCount,
    liveRoundLabel: liveRound ? `Round ${liveRound.roundNumber}` : '',
  }
}

function ReadinessStat({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 ring-1 ${ok ? 'bg-emerald-50 text-emerald-900 ring-emerald-100' : 'bg-white text-slate-700 ring-slate-200'}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  )
}

function ManualSide({
  side,
  players,
  format,
  onSave,
}: {
  side: AdminTrip['rounds'][number]['matches'][number]['sides'][number]
  players: AdminTrip['players']
  format: string
  onSave: (playerIds: string[]) => void
}) {
  const [value, setValue] = useState(side.players.map((entry) => entry.playerId).join(','))
  const selected = value.split(',').filter(Boolean)
  const slotCount = format === 'SINGLES' ? 1 : (format === 'FOUR_BALL' || format === 'ALT_SHOT') ? 2 : 4

  function setAt(index: number, playerId: string) {
    const next = [...selected]
    next[index] = playerId
    setValue(next.filter(Boolean).join(','))
  }

  return (
    <div className="rounded-xl bg-white p-2 ring-1 ring-slate-200">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{side.team?.name ?? side.label ?? 'Side'}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {Array.from({ length: slotCount }, (_, index) => (
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
