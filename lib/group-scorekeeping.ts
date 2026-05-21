import { getDb } from './db'

export function playerIdsForFoursome(foursome: {
  player1Id: string | null
  player2Id: string | null
  player3Id: string | null
  player4Id: string | null
}) {
  return [foursome.player1Id, foursome.player2Id, foursome.player3Id, foursome.player4Id].filter((id): id is string => Boolean(id))
}

export async function getAuthorizedGroupScorekeeper(params: {
  tripId: string
  roundId: string
  scorekeeperPlayerId: string
  targetPlayerId?: string
}) {
  const db = getDb()
  const foursome = await db.foursome.findFirst({
    where: {
      tripId: params.tripId,
      roundId: params.roundId,
      OR: [
        { player1Id: params.scorekeeperPlayerId },
        { player2Id: params.scorekeeperPlayerId },
        { player3Id: params.scorekeeperPlayerId },
        { player4Id: params.scorekeeperPlayerId },
      ],
    },
  })
  if (!foursome) return { error: 'No group found for this round.' as const }
  if (foursome.scorekeeperPlayerId !== params.scorekeeperPlayerId) {
    return { error: 'You are not the selected scorekeeper for this group.' as const }
  }

  const memberIds = playerIdsForFoursome(foursome)
  if (params.targetPlayerId && !memberIds.includes(params.targetPlayerId)) {
    return { error: 'That player is not in your group.' as const }
  }

  return { foursome, memberIds }
}
