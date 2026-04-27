import { NextResponse } from 'next/server'

const GOLF_COURSE_API_BASE = 'https://api.golfcourseapi.com'

type NormalizedCourse = {
  id: string
  name: string
  city?: string
  state?: string
  country?: string
  holes?: number
  source?: 'manual' | 'golfcourseapi' | 'bluegolf'
  blueGolfUrl?: string
}

type RankedCourse = NormalizedCourse & {
  rank: number
}

const BLUEGOLF_DIRECTORY_URL = 'https://course.bluegolf.com/bluegolf/course/course/directory.htm'
const COURSE_STOP_WORDS = new Set(['and', 'at', 'club', 'course', 'gc', 'golf', 'resort', 'the'])
const COURSE_VARIANT_WORDS = new Set(['black', 'blue', 'gold', 'green', 'red', 'silver', 'white'])

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim()

  if (!query) {
    return NextResponse.json({ courses: [] })
  }

  const blueGolfCourses = await searchBlueGolf(query)
  const apiKey = process.env.GOLF_COURSE_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      error: blueGolfCourses.length ? undefined : 'Course search is not configured yet. Add GOLF_COURSE_API_KEY to enable live course search.',
      courses: blueGolfCourses.length ? blueGolfCourses : fallbackCourses(query),
      fallback: !blueGolfCourses.length,
      source: blueGolfCourses.length ? 'bluegolf' : 'manual',
    })
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
    if (courses.length || blueGolfCourses.length) {
      return NextResponse.json({ courses: [...blueGolfCourses, ...courses].slice(0, 12), source: blueGolfCourses.length ? 'mixed' : 'golfcourseapi' })
    }
  }

  return NextResponse.json({
    error: blueGolfCourses.length ? undefined : 'GolfCourseAPI did not return courses for the attempted endpoint shapes.',
    courses: blueGolfCourses.length ? blueGolfCourses : fallbackCourses(query),
    fallback: !blueGolfCourses.length,
    source: blueGolfCourses.length ? 'bluegolf' : 'manual',
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
      source: 'golfcourseapi',
    }
  })
}

async function searchBlueGolf(query: string): Promise<NormalizedCourse[]> {
  const variants = buildBlueGolfQueryVariants(query)
  const scorecardCandidates = buildBlueGolfScorecardCandidates(query)
  const [directoryResults, scorecardResults] = await Promise.all([
    Promise.all(variants.map((variant) => fetchBlueGolfDirectory(variant))),
    Promise.all(scorecardCandidates.map((courseId) => fetchBlueGolfScorecardCandidate(courseId, query))),
  ])
  const rankedById = new Map<string, RankedCourse>()

  for (const course of [...directoryResults.flat(), ...scorecardResults.filter(Boolean) as NormalizedCourse[]]) {
    const existing = rankedById.get(course.id)
    const rank = rankBlueGolfCourse(course, query)
    if (!existing || rank > existing.rank) {
      rankedById.set(course.id, { ...course, rank })
    }
  }

  return [...rankedById.values()]
    .sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name))
    .slice(0, 8)
    .map(({ rank: _rank, ...course }) => course)
}

async function fetchBlueGolfDirectory(query: string): Promise<NormalizedCourse[]> {
  const url = `${BLUEGOLF_DIRECTORY_URL}?q=${encodeURIComponent(query)}`
  const res = await fetch(url, { next: { revalidate: 60 * 60 }, signal: AbortSignal.timeout(5000) }).catch(() => null)
  if (!res?.ok) return []

  const html = await res.text()
  const rows = [...html.matchAll(/<tr[^>]*>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi)]
  const courses: NormalizedCourse[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const href = row[1].match(/href=["']([^"']+\/index\.htm)["']/i)?.[1]
    const courseId = row[1].match(/name=["']c["']\s+value=["']([^"']+)["']/i)?.[1] ?? href?.replace(/\/index\.htm$/i, '')
    if (!href || !courseId || seen.has(courseId)) continue

    const name = textFromHtml(row[1].match(/d-none d-md-block["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? row[1])
    const location = textFromHtml(row[2]).replace(/\s*,\s*/, ', ')
    const [city, state] = location.split(',').map((part) => part.trim())

    seen.add(courseId)
    courses.push({
      id: `bluegolf-${courseId}`,
      name,
      city,
      state,
      holes: 18,
      source: 'bluegolf',
      blueGolfUrl: `https://course.bluegolf.com/bluegolf/course/course/${courseId}/detailedscorecard.htm`,
    })
  }

  return courses.slice(0, 8)
}

async function fetchBlueGolfScorecardCandidate(courseId: string, query: string): Promise<NormalizedCourse | null> {
  const url = `https://course.bluegolf.com/bluegolf/course/course/${courseId}/detailedscorecard.htm`
  const res = await fetch(url, { next: { revalidate: 60 * 60 }, signal: AbortSignal.timeout(5000) }).catch(() => null)
  if (!res?.ok) return null

  const html = await res.text()
  if (!/Scorecard Help|Detailed Scorecard|Tee\s*<\/th>/i.test(html)) return null

  const title = textFromHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
    .replace(/\s*-\s*Detailed Scorecard\s*\|\s*Course Database\s*$/i, '')
  const heading = textFromHtml(html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1] ?? '')
  const name = title || heading || titleCaseCourseName(query)

  return {
    id: `bluegolf-${courseId}`,
    name,
    holes: 18,
    source: 'bluegolf',
    blueGolfUrl: url,
  }
}

function buildBlueGolfQueryVariants(query: string) {
  const normalized = normalizeCourseText(query)
  const tokens = tokenizeCourseText(query)
  const meaningfulTokens = tokens.filter((token) => !COURSE_STOP_WORDS.has(token))
  const variantTokens = meaningfulTokens.filter((token) => COURSE_VARIANT_WORDS.has(token))
  const baseTokens = meaningfulTokens.filter((token) => !COURSE_VARIANT_WORDS.has(token))
  const variants = [
    query.trim(),
    normalized,
    meaningfulTokens.join(' '),
    baseTokens.join(' '),
    baseTokens.length && variantTokens.length ? `${baseTokens.join(' ')} ${variantTokens.join(' ')}` : '',
    meaningfulTokens.length > 1 ? meaningfulTokens[0] : '',
  ]

  return [...new Set(variants.map((variant) => variant.trim()).filter(Boolean))].slice(0, 5)
}

function buildBlueGolfScorecardCandidates(query: string) {
  const tokens = tokenizeCourseText(query)
  const slugTokens = tokens.filter((token) => !['and', 'at', 'club', 'course', 'gc', 'golf', 'the'].includes(token))
  const meaningfulTokens = slugTokens.filter((token) => token !== 'resort')
  const baseTokens = meaningfulTokens.filter((token) => !COURSE_VARIANT_WORDS.has(token))
  const variantTokens = meaningfulTokens.filter((token) => COURSE_VARIANT_WORDS.has(token))
  const slugs = [
    meaningfulTokens.join(''),
    slugTokens.join(''),
    slugTokens.join('').slice(0, 20),
    baseTokens.length && variantTokens.length ? `${baseTokens.join('')}${variantTokens.join('')}` : '',
  ]

  return [...new Set(slugs.map((slug) => slug.trim()).filter((slug) => slug.length >= 5))].slice(0, 4)
}

function rankBlueGolfCourse(course: NormalizedCourse, query: string) {
  const normalizedQuery = normalizeCourseText(query)
  const normalizedName = normalizeCourseText(course.name)
  const queryTokens = tokenizeCourseText(query).filter((token) => !COURSE_STOP_WORDS.has(token))
  const nameTokens = tokenizeCourseText(course.name)
  const matchedTokens = queryTokens.filter((token) => nameTokens.includes(token))
  const variantMatches = queryTokens.filter((token) => COURSE_VARIANT_WORDS.has(token) && nameTokens.includes(token))
  const coverage = queryTokens.length ? matchedTokens.length / queryTokens.length : 0
  const unmatchedPenalty = Math.max(nameTokens.length - matchedTokens.length, 0)

  let rank = coverage * 100 - unmatchedPenalty

  if (normalizedName === normalizedQuery) rank += 100
  if (normalizedName.includes(normalizedQuery)) rank += 45
  if (normalizedQuery.includes(normalizedName)) rank += 25
  if (matchedTokens.length === queryTokens.length && queryTokens.length > 0) rank += 35
  rank += variantMatches.length * 30

  return rank
}

function fallbackCourses(query: string): NormalizedCourse[] {
  return [
    {
      id: 'manual-fallback',
      name: query,
      city: 'Manual course entry',
      state: 'Live search unavailable',
      holes: 18,
      source: 'manual',
    },
  ]
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value ? value : undefined
}

function textFromHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeCourseText(value: string) {
  return tokenizeCourseText(value).join(' ')
}

function tokenizeCourseText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function titleCaseCourseName(value: string) {
  return tokenizeCourseText(value)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}
