import Link from 'next/link'
import { getDb } from '@/lib/db'
import { formatLabel } from '@/lib/tenant-data'

export default async function ScorecardPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripSlug: string }>
  searchParams: Promise<{ roundId?: string; playerId?: string; matchId?: string }>
}) {
  const { tripSlug } = await params
  const query = await searchParams
  const data = await getScorecardData(tripSlug, query)

  if (!data) {
    return (
      <main className="min-h-screen bg-[#f6f7f3] px-4 py-4 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">Scorecard not found.</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f6f7f3] px-4 py-4 text-slate-950">
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="rounded-[30px] bg-slate-950 p-5 text-white shadow-sm">
          <Link href={`/t/${tripSlug}/team`} className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Back to team board</Link>
          <h1 className="mt-3 text-3xl font-black">{data.title}</h1>
          <p className="mt-1 text-sm text-slate-300">Round {data.round.roundNumber} - {formatLabel(data.round.format)} - {data.round.course?.name ?? 'Course pending'}</p>
        </section>

        <section className="overflow-x-auto rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-black">Player</th>
                {data.holes.map((hole) => (
                  <th key={hole.holeNumber} className="px-2 py-2 text-center font-black">H{hole.holeNumber}</th>
                ))}
                <th className="px-3 py-2 text-center font-black">Gross</th>
              </tr>
            </thead>
            <tbody>
              {data.players.map((player) => (
                <tr key={player.id}>
                  <td className="sticky left-0 z-10 border-t border-slate-100 bg-white px-3 py-3 font-black">{player.name}</td>
                  {data.holes.map((hole) => (
                    <td key={hole.holeNumber} className="border-t border-slate-100 px-2 py-3 text-center font-bold text-slate-700">
                      {player.scores[hole.holeNumber] ?? '-'}
                    </td>
                  ))}
                  <td className="border-t border-slate-100 px-3 py-3 text-center font-black">{player.gross || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  )
}

async function getScorecardData(slug: string, query: { roundId?: string; playerId?: string; matchId?: string }) {
  const db = getDb()
  const trip = await db.trip.findUnique({
    where: { slug },
    include: {
      players: { orderBy: { name: 'asc' } },
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: {
          course: { include: { holes: { orderBy: { holeNumber: 'asc' } } } },
          scores: { include: { player: true } },
          matches: {
            include: {
              sides: { orderBy: { sideIndex: 'asc' }, include: { players: { include: { player: true }, orderBy: { position: 'asc' } } } },
            },
          },
        },
      },
    },
  })
  if (!trip) return null
  const round = trip.rounds.find((item) => item.id === query.roundId) ?? trip.rounds.find((item) => item.status === 'LIVE') ?? trip.rounds[0]
  if (!round?.course) return null

  const match = query.matchId ? round.matches.find((item) => item.id === query.matchId) : null
  const playerIds = match
    ? match.sides.flatMap((side) => side.players.map((entry) => entry.playerId))
    : query.playerId
      ? [query.playerId]
      : [...new Set(round.scores.map((score) => score.playerId))]

  const rows = playerIds.map((playerId) => {
    const player = trip.players.find((item) => item.id === playerId) ?? round.scores.find((score) => score.playerId === playerId)?.player
    const scores = Object.fromEntries(round.scores.filter((score) => score.playerId === playerId).map((score) => [score.holeNumber, score.gross]))
    return {
      id: playerId,
      name: player?.name ?? 'Player',
      scores,
      gross: Object.values(scores).reduce<number>((sum, score) => sum + Number(score), 0),
    }
  })

  const title = match
    ? `Match ${match.matchNumber} Scorecard`
    : rows[0]
      ? `${rows[0].name} Scorecard`
      : 'Round Scorecard'

  return {
    title,
    round,
    holes: round.course.holes,
    players: rows,
  }
}
