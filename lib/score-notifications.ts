import { getDb } from './db'

export async function emitScoreMilestones(params: {
  tripId: string
  roundId: string
  playerId: string
  playerName: string
  holeNumber: number
  gross: number
  par: number
}) {
  const db = getDb()
  const scoreToPar = params.gross - params.par
  const events = []

  if (scoreToPar <= -2) {
    events.push({
      tripId: params.tripId,
      type: 'EAGLE',
      payload: { title: `${params.playerName} made eagle on ${params.holeNumber}.`, playerId: params.playerId, roundId: params.roundId },
    })
  } else if (scoreToPar === -1) {
    events.push({
      tripId: params.tripId,
      type: 'BIRDIE',
      payload: { title: `${params.playerName} made birdie on ${params.holeNumber}.`, playerId: params.playerId, roundId: params.roundId },
    })
  }

  const recent = await db.holeScore.findMany({
    where: {
      roundId: params.roundId,
      playerId: params.playerId,
      holeNumber: { in: [params.holeNumber - 2, params.holeNumber - 1, params.holeNumber] },
    },
    include: { hole: true },
  })
  if (recent.length === 3 && recent.every((score) => score.hole && score.gross <= score.hole.par)) {
    events.push({
      tripId: params.tripId,
      type: 'HOT_STREAK',
      payload: { title: `${params.playerName} is on a three-hole heater.`, playerId: params.playerId, roundId: params.roundId },
    })
  }

  if (events.length) await db.notificationEvent.createMany({ data: events })
}
