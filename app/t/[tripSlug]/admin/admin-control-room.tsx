'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { SandbaggerRow } from '@/lib/trip-view-data'

type AdminTrip = {
  slug: string
  inviteCode: string
  status: string
  maxPlayers: number
  teamMethod: string
  pairingMethod: string
  players: Array<{ id: string; name: string; handicap: number | null }>
  courses: Array<{ id: string; name: string; dayNumber: number; teeName: string | null; rating: number | null; slope: number | null; teeOptions: unknown }>
  teams: Array<{ id: string; name: string; players: Array<{ playerId: string; player: { id: string; name: string; handicap: number | null } }> }>
  rounds: Array<{
    id: string
    roundNumber: number
    format: string
    status: string
    courseId: string | null
    submissions: Array<{ playerId: string; submittedAt: Date | string }>
    playerTees: Array<{ playerId: string; teeName: string }>
    matches: Array<{
      id: string
      matchNumber: number
      voidedAt: Date | string | null
      voidReason: string | null
      sides: Array<{ id: string; label: string | null; team: { name: string } | null; players: Array<{ playerId: string; player: { id: string; name: string } }> }>
    }>
  }>
}

type Tab = 'status' | 'rounds' | 'players' | 'matchups' | 'handicap' | 'breakglass'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'status', label: 'Status' },
  { id: 'rounds', label: 'Rounds' },
  { id: 'players', label: 'Players' },
  { id: 'matchups', label: 'Matchups' },
  { id: 'handicap', label: 'Handicap' },
  { id: 'breakglass', label: 'Break Glass' },
]

export function AdminControlRoom({ trip, canAdmin, adminRole, sandbaggerData = [] }: { trip: AdminTrip; canAdmin: boolean; adminRole: string | null; sandbaggerData?: SandbaggerRow[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('status')
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

  const isOwner = adminRole === 'OWNER'

  return (
    <section className="space-y-4">
      <div className="-mb-2 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-2xl px-4 py-2 text-xs font-black transition-colors ${tab === t.id ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {message ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100">{message}</p> : null}

      {tab === 'status' && <StatusTab trip={trip} mutate={mutate} isPending={isPending} />}
      {tab === 'rounds' && <RoundsTab trip={trip} mutate={mutate} isPending={isPending} />}
      {tab === 'players' && <PlayersTab trip={trip} mutate={mutate} isPending={isPending} />}
      {tab === 'matchups' && <MatchupsTab trip={trip} mutate={mutate} />}
      {tab === 'handicap' && <HandicapTab rows={sandbaggerData} mutate={mutate} players={trip.players} isOwner={isOwner} />}
      {tab === 'breakglass' && <BreakGlassTab trip={trip} isOwner={isOwner} mutate={mutate} />}
    </section>
  )
}

// ─── Status tab ─────────────────────────────────────────────────────────────

function StatusTab({ trip, mutate, isPending }: { trip: AdminTrip; mutate: Mutate; isPending: boolean }) {
  const [copied, setCopied] = useState(false)
  const readiness = getReadiness(trip)

  return (
    <div className="space-y-4">
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
        <SectionTitle title="Trip Status" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ReadinessStat label="Players" value={`${trip.players.length}/${trip.maxPlayers}`} ok={trip.players.length >= 2} />
          <ReadinessStat label="Teams" value={trip.teams.length ? String(trip.teams.length) : 'None'} ok={trip.teams.length > 0} />
          <ReadinessStat label="Matches" value={String(readiness.matchCount)} ok={readiness.matchCount > 0} />
          <ReadinessStat label="Live Round" value={readiness.liveRoundLabel || 'None'} ok={Boolean(readiness.liveRoundLabel)} />
        </div>
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Next Action</p>
            <p className="mt-1 font-black text-slate-950">{readiness.nextAction}</p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${readiness.ready ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
            {readiness.ready ? 'Ready' : 'Needs Work'}
          </span>
        </div>
        {readiness.issues.length ? (
          <div className="mt-3 space-y-2">
            {readiness.issues.map((issue) => (
              <p key={issue} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200">{issue}</p>
            ))}
          </div>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => mutate({ action: 'generate-teams' })} disabled={isPending} className="rounded-2xl bg-slate-950 px-4 py-4 font-black text-white disabled:opacity-60">Generate Teams</button>
          <button onClick={() => mutate({ action: 'generate-matches' })} disabled={isPending} className="rounded-2xl bg-indigo-600 px-4 py-4 font-black text-white disabled:opacity-60">Generate Matches</button>
        </div>
      </section>
    </div>
  )
}

// ─── Rounds tab ──────────────────────────────────────────────────────────────

function RoundsTab({ trip, mutate, isPending }: { trip: AdminTrip; mutate: Mutate; isPending: boolean }) {
  const [selectedRound, setSelectedRound] = useState(trip.rounds[0]?.id ?? '')
  const round = trip.rounds.find((r) => r.id === selectedRound) ?? trip.rounds[0]

  if (!round) return <EmptyCard>No rounds configured yet.</EmptyCard>

  const course = trip.courses.find((c) => c.id === round.courseId)
  const teeOptions = course ? getTeeOptions(course) : []

  return (
    <div className="space-y-4">
      {trip.rounds.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {trip.rounds.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRound(r.id)}
              className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-black ${r.id === selectedRound ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
            >
              R{r.roundNumber}
            </button>
          ))}
        </div>
      ) : null}

      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <SectionTitle title={`Round ${round.roundNumber}`} />
            <p className="mt-1 text-sm font-semibold text-slate-500">{round.format.replace(/_/g, ' ')} · {round.status.replace(/_/g, ' ')}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${
            round.status === 'LIVE' ? 'bg-emerald-100 text-emerald-800' :
            round.status === 'FINAL' ? 'bg-slate-200 text-slate-700' :
            'bg-amber-100 text-amber-800'
          }`}>
            {round.status.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button onClick={() => mutate({ action: 'start-round', roundId: round.id })} disabled={isPending} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60">Start</button>
          <button onClick={() => mutate({ action: 'finalize-round', roundId: round.id })} disabled={isPending} className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white disabled:opacity-60">Finalize</button>
          <button onClick={() => mutate({ action: 'reset-round', roundId: round.id })} disabled={isPending} className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700 ring-1 ring-red-100 disabled:opacity-60">Reset</button>
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title="Player Scorecards" />
        <div className="mt-3 space-y-2">
          {trip.players.map((player) => {
            const submitted = round.submissions.some((s) => s.playerId === player.id)
            const currentTee = round.playerTees.find((t) => t.playerId === player.id)?.teeName ?? course?.teeName ?? ''
            return (
              <div key={player.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl bg-slate-50 p-3">
                <div className="min-w-0">
                  <p className="truncate font-black">{player.name}</p>
                  <p className="text-xs font-semibold text-slate-500">HCP {player.handicap ?? 0}</p>
                  {submitted
                    ? <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Submitted</p>
                    : <p className="text-xs font-semibold text-slate-400">Open scorecard</p>
                  }
                </div>
                {teeOptions.length > 1 ? (
                  <select
                    value={currentTee}
                    onChange={(e) => mutate({ type: 'player-tee', playerId: player.id, roundId: round.id, teeName: e.target.value }, 'PATCH')}
                    className="max-w-32 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold"
                  >
                    {teeOptions.map((tee) => <option key={tee.name} value={tee.name}>{tee.name}</option>)}
                  </select>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

// ─── Players tab ─────────────────────────────────────────────────────────────

function PlayersTab({ trip, mutate, isPending }: { trip: AdminTrip; mutate: Mutate; isPending: boolean }) {
  return (
    <div className="space-y-4">
      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title={trip.teamMethod === 'MANUAL' ? 'Manual Team Selection' : 'Team Assignments'} />
        <p className="mt-1 text-xs text-slate-400">{trip.players.length} of {trip.maxPlayers} players registered</p>
        <div className="mt-3 space-y-2">
          {trip.players.map((player) => {
            const currentTeam = trip.teams.find((team) => team.players.some((e) => e.playerId === player.id))
            return (
              <div key={player.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl bg-slate-50 p-3">
                <div>
                  <p className="font-black">{player.name}</p>
                  <p className="text-sm font-semibold text-slate-500">HCP {player.handicap ?? 0}</p>
                </div>
                <select
                  value={currentTeam?.id ?? ''}
                  onChange={(e) => mutate({ type: 'team-assignment', playerId: player.id, teamId: e.target.value }, 'PATCH')}
                  disabled={isPending}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold disabled:opacity-60"
                >
                  <option value="">Unassigned</option>
                  {trip.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </div>
            )
          })}
          {!trip.players.length ? <p className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-500">No players have joined yet.</p> : null}
        </div>
      </section>

      {trip.teams.length ? (
        <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <SectionTitle title="Team Roster" />
          <div className="mt-3 space-y-3">
            {trip.teams.map((team) => (
              <div key={team.id} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="font-black text-slate-950">{team.name}</p>
                <div className="mt-2 space-y-1">
                  {team.players.map((entry) => (
                    <p key={entry.playerId} className="text-sm font-semibold text-slate-600">
                      {entry.player.name} · HCP {entry.player.handicap ?? 0}
                    </p>
                  ))}
                  {!team.players.length ? <p className="text-sm text-slate-400">No players assigned</p> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

// ─── Matchups tab ────────────────────────────────────────────────────────────

function MatchupsTab({ trip, mutate }: { trip: AdminTrip; mutate: Mutate }) {
  const [selectedRound, setSelectedRound] = useState(trip.rounds[0]?.id ?? '')
  const round = trip.rounds.find((r) => r.id === selectedRound) ?? trip.rounds[0]

  return (
    <div className="space-y-4">
      {trip.rounds.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {trip.rounds.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRound(r.id)}
              className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-black ${r.id === selectedRound ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
            >
              R{r.roundNumber}
            </button>
          ))}
        </div>
      ) : null}

      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title={trip.pairingMethod === 'MANUAL' ? 'Manual Pairings' : 'Matchups'} />
        {round ? (
          <div className="mt-3 space-y-3">
            {round.matches.map((match) => (
              <div key={match.id} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black">Match {match.matchNumber}</p>
                  {match.voidedAt ? <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-black text-red-700">Voided</span> : null}
                </div>
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
            ))}
            {!round.matches.length ? (
              <p className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-500">Generate matches to view and edit pairings.</p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}

// ─── Handicap tab ─────────────────────────────────────────────────────────────

function HandicapTab({ rows, mutate, players, isOwner }: { rows: SandbaggerRow[]; mutate: Mutate; players: AdminTrip['players']; isOwner: boolean }) {
  const [adjusting, setAdjusting] = useState<string | null>(null)
  const [newValue, setNewValue] = useState('')
  const [reason, setReason] = useState('')

  const flagColors: Record<string, string> = {
    SANDBAGGER: 'text-rose-700 bg-rose-50 ring-rose-100',
    SOUNDS_ABOUT_RIGHT: 'text-emerald-700 bg-emerald-50 ring-emerald-100',
    BUM: 'text-amber-700 bg-amber-50 ring-amber-100',
  }
  const flagLabels: Record<string, string> = {
    SANDBAGGER: 'Sandbagger',
    SOUNDS_ABOUT_RIGHT: 'Legit',
    BUM: 'Bum',
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title="Handicap Integrity" />
        <p className="mt-1 text-xs text-slate-400">USGA frequency analysis for all finalized rounds. A sandbagger posted a net score statistically unlikely given their handicap.</p>
        {!rows.length ? (
          <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-500">No finalized rounds with course data yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {rows.map((row) => (
              <div key={`${row.playerId}-${row.roundId}`} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-black">{row.playerName}</p>
                    <p className="text-xs text-slate-500">{row.roundName} · HCP {row.handicap} · Gross {row.grossTotal} ({row.holesPlayed}H)</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-black ring-1 ${flagColors[row.flag] ?? 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                    {flagLabels[row.flag] ?? row.flag}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white p-2 ring-1 ring-slate-200">
                    <p className="text-xs text-slate-400">Net Δ</p>
                    <p className="font-black">{row.netDelta > 0 ? `+${row.netDelta}` : row.netDelta}</p>
                  </div>
                  <div className="rounded-xl bg-white p-2 ring-1 ring-slate-200">
                    <p className="text-xs text-slate-400">1-in-N</p>
                    <p className="font-black">{row.odds ? Math.round(row.odds) : '—'}</p>
                  </div>
                  <div className="rounded-xl bg-white p-2 ring-1 ring-slate-200">
                    <p className="text-xs text-slate-400">Band</p>
                    <p className="font-black">{row.handicapBand ?? '—'}</p>
                  </div>
                </div>
                {row.flag === 'SANDBAGGER' ? (
                  adjusting === `${row.playerId}-${row.roundId}` ? (
                    <div className="mt-2 space-y-2">
                      <input value={newValue} onChange={(e) => setNewValue(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" placeholder="New handicap" inputMode="decimal" />
                      <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" placeholder="Reason" />
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setAdjusting(null)} className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-black text-slate-700">Cancel</button>
                        <button
                          disabled={!isOwner || !newValue}
                          onClick={() => { mutate({ action: 'adjust-handicap', playerId: row.playerId, newValue: Number(newValue), reason }); setAdjusting(null) }}
                          className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-black text-white disabled:opacity-40"
                        >
                          Adjust
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      disabled={!isOwner}
                      onClick={() => { setAdjusting(`${row.playerId}-${row.roundId}`); setNewValue(String(row.handicap)); setReason('') }}
                      className="mt-2 w-full rounded-xl bg-rose-50 px-3 py-2 text-sm font-black text-rose-700 ring-1 ring-rose-100 disabled:opacity-40"
                    >
                      Adjust Handicap
                    </button>
                  )
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title="Manual Handicap Adjustment" />
        <p className="mt-1 text-xs text-slate-400">Override any player&apos;s handicap with an audit record.</p>
        <AdjustHandicapForm players={players} isOwner={isOwner} mutate={mutate} />
      </section>
    </div>
  )
}

// ─── Break Glass tab ──────────────────────────────────────────────────────────

function BreakGlassTab({ trip, isOwner, mutate }: { trip: AdminTrip; isOwner: boolean; mutate: Mutate }) {
  const [voidReason, setVoidReason] = useState('')
  const [override, setOverride] = useState({ roundId: trip.rounds[0]?.id ?? '', playerId: trip.players[0]?.id ?? '', holeNumber: '1', gross: '5', reason: '' })

  return (
    <div className="space-y-4">
      {!isOwner ? <p className="rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900 ring-1 ring-amber-100">Owner access is required for these tools.</p> : null}

      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title="Void Match" />
        <p className="mt-1 text-xs text-slate-400">Remove a match from scoring. Useful for no-shows or lineup errors.</p>
        <input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" placeholder="Reason (required)" />
        <div className="mt-2 space-y-2">
          {trip.rounds.flatMap((round) => round.matches.map((match) => (
            <button
              key={match.id}
              disabled={!isOwner || Boolean(match.voidedAt) || !voidReason.trim()}
              onClick={() => mutate({ action: 'void-match', matchId: match.id, reason: voidReason })}
              className="w-full rounded-xl bg-white px-3 py-2 text-left text-sm font-black text-rose-700 ring-1 ring-slate-200 disabled:opacity-40"
            >
              R{round.roundNumber} Match {match.matchNumber}{match.voidedAt ? ' — voided' : ''}
            </button>
          )))}
          {!trip.rounds.some((r) => r.matches.length) ? <p className="text-sm text-slate-400">No matches yet.</p> : null}
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title="Override Score" />
        <p className="mt-1 text-xs text-slate-400">Correct a specific hole score for a player.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <select value={override.roundId} onChange={(e) => setOverride({ ...override, roundId: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold">
            {trip.rounds.map((r) => <option key={r.id} value={r.id}>Round {r.roundNumber}</option>)}
          </select>
          <select value={override.playerId} onChange={(e) => setOverride({ ...override, playerId: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold">
            {trip.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input value={override.holeNumber} onChange={(e) => setOverride({ ...override, holeNumber: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" placeholder="Hole #" inputMode="numeric" />
          <input value={override.gross} onChange={(e) => setOverride({ ...override, gross: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" placeholder="Gross" inputMode="numeric" />
        </div>
        <input value={override.reason} onChange={(e) => setOverride({ ...override, reason: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" placeholder="Reason" />
        <button
          disabled={!isOwner}
          onClick={() => mutate({ action: 'override-score', ...override, holeNumber: Number(override.holeNumber), gross: Number(override.gross) })}
          className="mt-2 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
        >
          Save Override
        </button>
      </section>

      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title="Round Rescue" />
        <p className="mt-1 text-xs text-slate-400">Force-finalize a round or wipe all scores if something went wrong.</p>
        <div className="mt-3 grid grid-cols-1 gap-2">
          {trip.rounds.map((round) => (
            <button key={round.id} disabled={!isOwner} onClick={() => mutate({ action: 'force-finalize', roundId: round.id })} className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white disabled:opacity-40">
              Force Finalize Round {round.roundNumber}
            </button>
          ))}
          <button
            disabled={!isOwner}
            onClick={() => window.confirm('Delete ALL scores and reset ALL rounds to NOT_STARTED? This cannot be undone.') && mutate({ action: 'emergency-wipe' })}
            className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
          >
            Emergency Wipe All Scores
          </button>
        </div>
      </section>
    </div>
  )
}

// ─── Shared sub-components ───────────────────────────────────────────────────

type Mutate = (body: unknown, method?: string) => void

function AdjustHandicapForm({ players, isOwner, mutate }: { players: AdminTrip['players']; isOwner: boolean; mutate: Mutate }) {
  const [handicap, setHandicap] = useState({ playerId: players[0]?.id ?? '', newValue: '', reason: '' })

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select value={handicap.playerId} onChange={(e) => setHandicap({ ...handicap, playerId: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold">
          {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input value={handicap.newValue} onChange={(e) => setHandicap({ ...handicap, newValue: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" placeholder="New HCP" inputMode="decimal" />
      </div>
      <input value={handicap.reason} onChange={(e) => setHandicap({ ...handicap, reason: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" placeholder="Reason" />
      <button
        disabled={!isOwner || !handicap.newValue}
        onClick={() => mutate({ action: 'adjust-handicap', playerId: handicap.playerId, newValue: Number(handicap.newValue), reason: handicap.reason })}
        className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
      >
        Save Adjustment
      </button>
    </div>
  )
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-white p-4 text-sm font-bold text-slate-500 ring-1 ring-slate-200">{children}</p>
}

function getTeeOptions(course: AdminTrip['courses'][number]) {
  const options = Array.isArray(course.teeOptions)
    ? course.teeOptions.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const name = (item as Record<string, unknown>).name
        return typeof name === 'string' && name.trim() ? [{ name }] : []
      })
    : []
  if (course.teeName && !options.some((tee) => tee.name === course.teeName)) return [{ name: course.teeName }, ...options]
  return options
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
  const [value, setValue] = useState(side.players.map((e) => e.playerId).join(','))
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
          <select key={index} value={selected[index] ?? ''} onChange={(e) => setAt(index, e.target.value)} className="min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold">
            <option value="">TBD</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
