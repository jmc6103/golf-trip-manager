import { LobbyView } from './lobby-view'

export default async function LobbyPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  return <LobbyView slug={tripSlug} />
}
