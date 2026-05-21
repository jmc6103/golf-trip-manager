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

export function AdminControlRoom({ trip, canAdmin, adminRole, sandbaggerData = [] }: { trip: AdminTrip; canAdmin: boolean; adminRole: string | null; sandbaggerData?: SandbaggerRow[] }) {
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
              <div className="mt-3 space-y-2">
                {trip.players.map((player) => {
                  const submitted = round.submissions.some((submission) => submission.playerId === player.id)
                  const course = trip.courses.find((item) => item.id === round.courseId)
                  const teeOptions = course ? getTeeOptions(course) : []
                  const currentTee = round.playerTees.find((tee) => tee.playerId === player.id)?.teeName ?? course?.teeName ?? ''
                  return (
                    <div key={player.id} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{player.name}</p>
                        {submitted ? <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Submitted</p> : <p className="text-xs font-semibold text-slate-500">Open scorecard</p>}
                      </div>
                      {teeOptions.length > 1 ? (
                        <select
                          value={currentTee}
                          onChange={(event) => mutate({ type: 'player-tee', playerId: player.id, roundId: round.id, teeName: event.target.value }, 'PATCH')}
                          className="max-w-36 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold"
                        >
                          {teeOptions.map((tee) => <option key={tee.name} value={tee.name}>{tee.name}</option>)}
                        </select>
                      ) : null}
                    </div>
                  )
                })}
              </div>
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

      <BreakGlassSection trip={trip} isOwner={adminRole === 'OWNER'} mutate={mutate} />
      {sandbaggerData.length > 0 ? <HandicapIntegritySection rows={sandbaggerData} mutate={mutate} players={trip.players} isOwner={adminRole === 'OWNER'} /> : null}
    </section>
  )
}

function BreakGlassSection({ trip, isOwner, mutate }: { trip: AdminTrip; isOwner: boolean; mutate: (body: unknown, method?: string) => void }) {
  const [voidReason, setVoidReason] = useState('')
  const [override, setOverride] = useState({ roundId: trip.rounds[0]?.id ?? '', playerId: trip.players[0]?.id ?? '', holeNumber: '1', gross: '5', reason: '' })
  const [handicap, setHandicap] = useState({ playerId: trip.players[0]?.id ?? '', newValue: '', reason: '' })

  return (
    <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <SectionTitle title="Break Glass" />
      {!isOwner ? <p className="mt-2 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900 ring-1 ring-amber-100">Owner access is required for these tools.</p> : null}
      <div className="mt-3 space-y-3">
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Void Match</p>
          <input value={voidReason} onChange={(event) => setVoidReason(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" placeholder="Reason" />
          <div className="mt-2 space-y-2">
            {trip.rounds.flatMap((round) => round.matches.map((match) => (
              <button key={match.id} disabled={!isOwner || Boolean(match.voidedAt)} onClick={() => mutate({ action: 'void-match', matchId: match.id, reason: voidReason })} className="w-full rounded-xl bg-white px-3 py-2 text-left text-sm font-black text-rose-700 ring-1 ring-slate-200 disabled:opacity-40">
                R{round.roundNumber} Match {match.matchNumber}{match.voidedAt ? ' - voided' : ''}
              </button>
            )))}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Override Score</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select value={override.roundId} onChange={(event) => setOverride({ ...override, roundId: event.target.value })} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold">
              {trip.rounds.map((round) => <option key={round.id} value={round.id}>Round {round.roundNumber}</option>)}
            </select>
            <select value={override.playerId} onChange={(event) => setOverride({ ...override, playerId: event.target.value })} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold">
              {trip.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
            <input value={override.holeNumber} onChange={(event) => setOverride({ ...override, holeNumber: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" placeholder="Hole" inputMode="numeric" />
            <input value={override.gross} onChange={(event) => setOverride({ ...override, gross: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" placeholder="Gross" inputMode="numeric" />
          </div>
          <input value={override.reason} onChange={(event) => setOverride({ ...override, reason: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" placeholder="Reason" />
          <button disabled={!isOwner} onClick={() => mutate({ action: 'override-score', ...override, holeNumber: Number(override.holeNumber), gross: Number(override.gross) })} className="mt-2 w-full rounded-xl bg-slate-950 px-3 py-3 text-sm font-black text-white disabled:opacity-40">Save Override</button>
        </div>

        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Round Rescue</p>
          <div className="mt-2 grid grid-cols-1 gap-2">
            {trip.rounds.map((round) => (
              <button key={round.id} disabled={!isOwner} onClick={() => mutate({ action: 'force-finalize', roundId: round.id })} className="rounded-xl bg-amber-500 px-3 py-3 text-sm font-black text-white disabled:opacity-40">
                Force Finalize Round {round.roundNumber}
              </button>
            ))}
            <button disabled={!isOwner} onClick={() => window.confirm('Delete all scores and reset all rounds?') && mutate({ action: 'emergency-wipe' })} className="rounded-xl bg-red-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40">
              Emergency Wipe Scores
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Adjust Handicap</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select value={handicap.playerId} onChange={(event) => setHandicap({ ...handicap, playerId: event.target.value })} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold">
              {trip.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
            <input value={handicap.newValue} onChange={(event) => setHandicap({ ...handicap, newValue: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" placeholder="New HCP" inputMode="decimal" />
          </div>
          <input value={handicap.reason} onChange={(event) => setHandicap({ ...handicap, reason: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" placeholder="Reason" />
          <button disabled={!isOwner} onClick={() => mutate({ action: 'adjust-handicap', playerId: handicap.playerId, newValue: Number(handicap.newValue), reason: handicap.reason })} className="mt-2 w-full rounded-xl bg-slate-950 px-3 py-3 text-sm font-black text-white disabled:opacity-40">Save Handicap</button>
        </div>
      </div>
    </section>
  )
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

function HandicapIntegritySection({
  rows,
  mutate,
  players,
  isOwner,
}: {
  rows: SandbaggerRow[]
  mutate: (body: unknown, method?: string) => void
  players: AdminTrip['players']
  isOwner: boolean
}) {
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
    <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <SectionTitle title="Handicap Integrity" />
      <p className="mt-1 text-xs text-slate-400">USGA frequency analysis for all finalized rounds.</p>
      <div className="mt-3 space-y-2">
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
                <p className="text-xs text-slate-400">1-in</p>
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
                    <button disabled={!isOwner || !newValue} onClick={() => { mutate({ action: 'adjust-handicap', playerId: row.playerId, newValue: Number(newValue), reason }); setAdjusting(null) }} className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-black text-white disabled:opacity-40">Adjust</button>
                  </div>
                </div>
              ) : (
                <button disabled={!isOwner} onClick={() => { setAdjusting(`${row.playerId}-${row.roundId}`); setNewValue(String(row.handicap)); setReason('') }} className="mt-2 w-full rounded-xl bg-rose-50 px-3 py-2 text-sm font-black text-rose-700 ring-1 ring-rose-100 disabled:opacity-40">
                  Adjust Handicap
                </button>
              )
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">{title}</h2>
}
