import { NextResponse } from 'next/server'
import { getPlayerCardData } from '@/lib/trip-view-data'

export async function GET(_req: Request, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const data = await getPlayerCardData(tripSlug)
  if (!data) return NextResponse.json({ error: 'No player card found.' }, { status: 404 })
  return NextResponse.json(data)
}
