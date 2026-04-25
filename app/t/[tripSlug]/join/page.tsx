import { notFound } from 'next/navigation'
import { joinTrip } from '@/app/actions'
import { getTripSummary } from '@/lib/tenant-data'

export default async function JoinPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = await getTripSummary(tripSlug)
  if (!trip) notFound()

  return (
    <main className="min-h-screen px-4 py-5 text-slate-950">
      <div className="mx-auto max-w-md rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Player Invite</p>
        <h1 className="mt-2 text-3xl font-black">Join {trip.name}</h1>
        <form action={joinTrip} className="mt-5 space-y-3">
          <input type="hidden" name="slug" value={trip.slug} />
          <input name="name" className="w-full rounded-2xl border border-slate-200 px-4 py-4 font-bold" placeholder="Name" required />
          <input name="email" className="w-full rounded-2xl border border-slate-200 px-4 py-4 font-bold" placeholder="Email (optional)" type="email" />
          <input name="handicap" className="w-full rounded-2xl border border-slate-200 px-4 py-4 font-bold" placeholder="Handicap" inputMode="decimal" />
          <button className="w-full rounded-2xl bg-slate-950 px-4 py-4 font-black text-white">Join Trip</button>
        </form>
      </div>
    </main>
  )
}
