import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTripLinks } from '@/lib/trip-data'
import { getTripSummary } from '@/lib/tenant-data'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  REGISTRATION: 'Registration Open',
  TEAMS_READY: 'Teams Ready',
  LIVE: 'Live',
  COMPLETE: 'Complete',
  ARCHIVED: 'Archived',
}

const PLAYER_CARD_STATUSES = new Set(['TEAMS_READY', 'LIVE', 'COMPLETE'])

export default async function TripHomePage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = await getTripSummary(tripSlug)
  if (!trip) notFound()

  const links = getTripLinks(trip.slug).filter(
    (link) => link.label !== 'Player' || PLAYER_CARD_STATUSES.has(trip.status)
  )

  return (
    <main className="min-h-screen px-4 py-5 text-slate-950">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
            {STATUS_LABELS[trip.status] ?? trip.status}
          </p>
          <h1 className="mt-2 text-3xl font-black">{trip.name}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-300">
            {trip.dates} - {trip.location}
          </p>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Metric label="Players" value={`${trip.playerCount}/${trip.maxPlayers}`} />
          <Metric label="Formats" value={String(trip.formats.length)} />
        </section>

        <section className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Trip Links</h2>
          <div className="mt-3 space-y-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="block rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black">{link.label}</p>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-200">
                    {link.role}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-500">{link.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-white p-4 text-center shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  )
}
