import { TeamBoard } from './team-board'

export default async function TeamPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  return <TeamBoard slug={tripSlug} />
}
