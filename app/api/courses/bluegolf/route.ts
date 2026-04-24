import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const url = typeof body?.url === 'string' ? body.url : ''

  if (!url) {
    return NextResponse.json({ error: 'BlueGolf URL is required.' }, { status: 400 })
  }

  const parsed = new URL(url)
  if (!parsed.hostname.endsWith('bluegolf.com')) {
    return NextResponse.json({ error: 'Only bluegolf.com URLs are supported for this import.' }, { status: 400 })
  }

  const res = await fetch(parsed.toString()).catch(() => null)
  if (!res?.ok) {
    return NextResponse.json({ error: 'Could not fetch the BlueGolf page.' }, { status: 502 })
  }

  const html = await res.text()
  const oneLineHtml = html.replace(/\n/g, ' ')
  const title = oneLineHtml.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim()
  const heading = oneLineHtml.match(/<h1[^>]*>(.*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

  return NextResponse.json({
    course: {
      name: heading || title?.replace(/\|.*$/, '').trim() || 'Imported BlueGolf course',
      teeName: '',
      rating: '',
      slope: '',
      source: 'bluegolf',
      blueGolfUrl: parsed.toString(),
    },
    note: 'Imported the basic course identity from BlueGolf. Full scorecard details may still need review.',
  })
}
