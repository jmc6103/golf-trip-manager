import { NextResponse } from 'next/server'
import { getTeamBoardData } from '@/lib/trip-view-data'

export async function GET(req: Request, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const { searchParams } = new URL(req.url)
  const round = Number(searchParams.get('round'))
  const data = await getTeamBoardData(tripSlug, Number.isFinite(round) ? round : undefined)
  if (!data) return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
  return NextResponse.json(data)
}
