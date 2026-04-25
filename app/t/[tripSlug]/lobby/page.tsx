import Link from 'next/link'
import { getLobbyData } from '@/lib/trip-view-data'

export default async function LobbyPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const data = await getLobbyData(tripSlug)
  if (!data) {
    return <main className="min-h-screen px-4 py-5 text-slate-950">Trip not found.</main>
  }

  const spotsLeft = Math.max(data.trip.maxPlayers - data.count, 0)
  const teamsReady = data.teams.length > 0

  return (
    <main className="min-h-screen bg-[#f6f7f3] px-4 py-4 pb-24 text-slate-950">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-[30px] bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Trip Lobby</p>
          <h1 className="mt-2 text-3xl font-black">{teamsReady ? 'Teams are ready' : 'Waiting room'}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {teamsReady ? 'Rosters are set. Jump to the live views or review who is in.' : 'Players join here before the admin creates teams and pairings.'}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Stat label="Registered" value={`${data.count}/${data.trip.maxPlayers}`} />
            <Stat label={teamsReady ? 'Status' : 'Spots Left'} value={teamsReady ? 'Ready' : String(spotsLeft)} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link href={`/t/${data.trip.slug}/team`} className="rounded-2xl bg-white px-4 py-4 text-center font-black text-slate-950">Team View</Link>
            <Link href={`/t/${data.trip.slug}/join`} className="rounded-2xl bg-white/10 px-4 py-4 text-center font-black text-white ring-1 ring-white/15">Invite</Link>
          </div>
        </section>

        {teamsReady ? (
          <div className="grid grid-cols-2 gap-3">
            {data.teams.map((team) => <Roster key={team.id} title={team.name} players={team.players} />)}
          </div>
        ) : (
          <Roster title="Registered Players" players={data.players} />
        )}

        <BottomNav slug={data.trip.slug} active="lobby" />
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white/10 p-4 ring-1 ring-white/15">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-300">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </div>
  )
}

function Roster({ title, players }: { title: string; players: Array<{ id: string; name: string; handicap: number }> }) {
  return (
    <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between px-1 pb-3">
        <h2 className="font-black text-slate-700">{title}</h2>
        <span className="text-xs font-bold text-slate-400">{players.length}</span>
      </div>
      <div className="space-y-2">
        {players.length ? players.map((player) => (
          <div key={player.id} className="rounded-2xl bg-slate-50 px-3 py-3">
            <p className="truncate font-bold">{player.name}</p>
            <p className="text-sm text-slate-500">Handicap {player.handicap}</p>
          </div>
        )) : <div className="rounded-2xl bg-slate-50 px-3 py-3 text-sm font-bold text-slate-500">No players yet.</div>}
      </div>
    </section>
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
