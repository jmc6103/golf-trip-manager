import { NextResponse } from 'next/server'

const GOLF_COURSE_API_BASE = 'https://api.golfcourseapi.com'

type NormalizedCourse = {
  id: string
  name: string
  city?: string
  state?: string
  country?: string
  holes?: number
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim()

  if (!query) {
    return NextResponse.json({ courses: [] })
  }

  const apiKey = process.env.GOLF_COURSE_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'Course search is not configured yet. Add GOLF_COURSE_API_KEY to enable live course search.',
        courses: fallbackCourses(query),
        fallback: true,
      },
      { status: 200 }
    )
  }

  const attempts = [
    `/v1/courses/search?search_query=${encodeURIComponent(query)}`,
    `/v1/courses?search_query=${encodeURIComponent(query)}`,
    `/courses/search?search_query=${encodeURIComponent(query)}`,
    `/courses?search_query=${encodeURIComponent(query)}`,
  ]

  for (const path of attempts) {
    const res = await fetch(`${GOLF_COURSE_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-API-Key': apiKey,
      },
      next: { revalidate: 60 * 30 },
    }).catch(() => null)

    if (!res?.ok) continue

    const json = await res.json()
    const courses = normalizeCourses(json)
    if (courses.length) {
      return NextResponse.json({ courses, source: 'golfcourseapi' })
    }
  }

  return NextResponse.json({
    error: 'GolfCourseAPI did not return courses for the attempted endpoint shapes.',
    courses: fallbackCourses(query),
    fallback: true,
  })
}

function normalizeCourses(payload: unknown): NormalizedCourse[] {
  const raw =
    Array.isArray(payload)
      ? payload
      : typeof payload === 'object' && payload
        ? (Object.values(payload).find((value) => Array.isArray(value)) as unknown[] | undefined) ?? []
        : []

  return raw.slice(0, 10).map((item, index) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      id: String(record.id ?? record.course_id ?? record.club_id ?? index),
      name: String(record.name ?? record.course_name ?? record.club_name ?? 'Unknown course'),
      city: asOptionalString(record.city),
      state: asOptionalString(record.state),
      country: asOptionalString(record.country),
      holes: typeof record.holes === 'number' ? record.holes : Number(record.number_of_holes) || undefined,
    }
  })
}

function fallbackCourses(query: string): NormalizedCourse[] {
  return [
    {
      id: 'manual-fallback',
      name: query,
      city: 'Manual course entry',
      state: 'Live search unavailable',
      holes: 18,
    },
  ]
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value ? value : undefined
}
