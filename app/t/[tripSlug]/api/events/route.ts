import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: Request, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  if (!process.env.DATABASE_URL) return NextResponse.json([])

  const { searchParams } = new URL(req.url)
  const since = searchParams.get('since')
  const sinceDate = since ? new Date(since) : null
  const db = getDb()
  const trip = await db.trip.findUnique({ where: { slug: tripSlug }, select: { id: true } })
  if (!trip) return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })

  const events = await db.notificationEvent.findMany({
    where: {
      tripId: trip.id,
      ...(sinceDate && Number.isFinite(sinceDate.getTime()) ? { createdAt: { gt: sinceDate } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: 25,
  })

  return NextResponse.json(events)
}
