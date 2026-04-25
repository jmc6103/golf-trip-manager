import { PlayerScorecard } from './player-scorecard'

export default async function PlayerPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  return <PlayerScorecard slug={tripSlug} />
}
