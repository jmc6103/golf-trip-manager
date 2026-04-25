import { NextResponse } from 'next/server'
import { getLobbyData } from '@/lib/trip-view-data'

export async function GET(_req: Request, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const data = await getLobbyData(tripSlug)
  if (!data) return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
  return NextResponse.json(data)
}
