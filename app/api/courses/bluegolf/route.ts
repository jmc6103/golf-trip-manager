import { NextResponse } from 'next/server'
import type { CourseDraft, CourseHoleDraft } from '@/lib/types'

type TeeOption = {
  id: string
  name: string
  gender: string
  rating: string
  slope: string
  yardage: number
  holes: CourseHoleDraft[]
}

const HOLE_COLUMNS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19]

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const url = typeof body?.url === 'string' ? body.url : ''

  if (!url) {
    return NextResponse.json({ error: 'BlueGolf URL is required.' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Enter a valid BlueGolf URL.' }, { status: 400 })
  }

  if (parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only HTTPS BlueGolf URLs are supported.' }, { status: 400 })
  }
  if (parsed.hostname !== 'bluegolf.com' && !parsed.hostname.endsWith('.bluegolf.com')) {
    return NextResponse.json({ error: 'Only bluegolf.com URLs are supported for this import.' }, { status: 400 })
  }

  const res = await fetch(parsed.toString()).catch(() => null)
  if (!res?.ok) {
    return NextResponse.json({ error: 'Could not fetch the BlueGolf page.' }, { status: 502 })
  }

  const html = await res.text()
  const courseName = parseCourseName(html)
  const teeOptions = parseTeeOptions(html)
  const selected = teeOptions[0]
  const course = buildCourseDraft({
    name: courseName,
    url: parsed.toString(),
    tee: selected,
  })
  const warnings: string[] = []

  if (!teeOptions.length) {
    warnings.push('Found the course page, but could not find a detailed scorecard table.')
  }
  if (teeOptions.length && !selected?.holes.length) {
    warnings.push('Found tee information, but hole-level par and handicap details need review.')
  }

  return NextResponse.json({
    course,
    teeOptions: teeOptions.map((tee) => ({
      ...tee,
      course: buildCourseDraft({ name: courseName, url: parsed.toString(), tee }),
    })),
    note: teeOptions.length
      ? `Imported ${teeOptions.length} tee option${teeOptions.length === 1 ? '' : 's'} from BlueGolf.`
      : 'Imported the basic course identity from BlueGolf. Full scorecard details still need review.',
    warnings,
  })
}

function buildCourseDraft({ name, url, tee }: { name: string; url: string; tee?: TeeOption }): Partial<CourseDraft> {
  return {
    name,
    teeName: tee ? `${tee.name}${tee.gender ? ` (${tee.gender})` : ''}` : '',
    rating: tee?.rating ?? '',
    slope: tee?.slope ?? '',
    holes: tee?.holes,
    source: 'bluegolf',
    blueGolfUrl: url,
  }
}

function parseCourseName(html: string) {
  const title = textFromHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const heading = textFromHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '')
  return heading || title.replace(/\s+-\s+Detailed Scorecard.*$/i, '').replace(/\|.*$/, '').trim() || 'Imported BlueGolf course'
}

function parseTeeOptions(html: string): TeeOption[] {
  const allTeesTable = html.match(/<table[^>]*class=["'][^"']*allTees[^"']*["'][^>]*>([\s\S]*?)<\/table>/i)?.[1]
  if (!allTeesTable) return parseActiveTee(html)

  const rows = parseRows(allTeesTable).filter((row) => row.some(Boolean))
  const parRow = rows.find((row) => normalizeLabel(row[0]) === 'par')
  const menHcpIndex = rows.findIndex((row) => normalizeLabel(row[0]).includes('mens hcp'))
  const womenHcpIndex = rows.findIndex((row) => normalizeLabel(row[0]).includes('womens hcp'))
  const menHcpRow = menHcpIndex >= 0 ? rows[menHcpIndex] : undefined
  const womenHcpRow = womenHcpIndex >= 0 ? rows[womenHcpIndex] : undefined
  const ratingMap = parseRatingMap(html)
  const teeRows = rows.filter((row, index) => {
    const label = normalizeLabel(row[0])
    return Boolean(row[0]) && !['tee', 'par'].includes(label) && !label.includes('hcp') && row.length >= 20 && index !== menHcpIndex && index !== womenHcpIndex
  })

  const seenByGender: Record<string, number> = {}
  const options: TeeOption[] = []

  for (const [index, row] of teeRows.entries()) {
    const gender = womenHcpIndex >= 0 && rows.indexOf(row) > womenHcpIndex ? 'L' : 'M'
    const name = row[0]
    const rating = shiftRating(ratingMap, name, gender, seenByGender)
    const hcpRow = gender === 'L' ? womenHcpRow ?? menHcpRow : menHcpRow ?? womenHcpRow
    const holes = buildHoles({ parRow, hcpRow, yardageRow: row })
    if (holes.length !== 18) continue

    options.push({
      id: `${gender}-${slugify(name)}-${index}`,
      name,
      gender,
      rating: rating?.rating ?? '',
      slope: rating?.slope ?? '',
      yardage: sumNumbers(row, HOLE_COLUMNS),
      holes,
    })
  }

  return options
}

function parseActiveTee(html: string): TeeOption[] {
  const activePane = html.match(/<div[^>]*class=["'][^"']*tee-tab active[^"']*["'][^>]*>([\s\S]*?)(?=<div class=["'][^"']*text-uppercase tab-pane|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)/i)?.[1]
  if (!activePane) return []

  const rows = parseRows(activePane).filter((row) => row.some(Boolean))
  const teeRow = rows.find((row) => normalizeLabel(row[0]) && !['tee', 'par'].includes(normalizeLabel(row[0])) && !normalizeLabel(row[0]).includes('hcp'))
  const parRow = rows.find((row) => normalizeLabel(row[0]) === 'par')
  const hcpRow = rows.find((row) => normalizeLabel(row[0]).includes('hcp'))
  if (!teeRow) return []

  const summary = parseScorecardSummary(activePane)
  const holes = buildHoles({ parRow, hcpRow, yardageRow: teeRow })
  return [{
    id: `active-${slugify(teeRow[0])}`,
    name: teeRow[0],
    gender: '',
    rating: summary.rating,
    slope: summary.slope,
    yardage: summary.yardage ? Number(summary.yardage) : sumNumbers(teeRow, HOLE_COLUMNS),
    holes,
  }]
}

function parseRows(tableHtml: string) {
  return [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => textFromHtml(cell[1]))
  )
}

function buildHoles({ parRow, hcpRow, yardageRow }: { parRow?: string[]; hcpRow?: string[]; yardageRow: string[] }) {
  const holes: CourseHoleDraft[] = []
  for (let index = 0; index < HOLE_COLUMNS.length; index += 1) {
    const column = HOLE_COLUMNS[index]
    const par = numberAt(parRow, column)
    const strokeIndex = numberAt(hcpRow, column)
    if (!par || !strokeIndex) continue
    holes.push({
      holeNumber: index + 1,
      par,
      strokeIndex,
      yardage: numberAt(yardageRow, column),
    })
  }
  return holes
}

function parseRatingMap(html: string) {
  const map: Record<string, Array<{ gender: string; rating: string; slope: string }>> = {}
  const links = [...html.matchAll(/<a[^>]*href=["']#dropdown-tee-[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi)]
  for (const link of links) {
    const label = textFromHtml(link[1].match(/ddm-center["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '')
    const stat = textFromHtml(link[1].match(/\(([^)]*\d+\.?\d*\/\d+)[^)]*\)/i)?.[1] ?? '')
    const match = stat.match(/^([ML])\s*-\s*(\d+(?:\.\d+)?)\/(\d+)$/i)
    if (!label || !match) continue
    const key = normalizeLabel(label)
    map[key] = map[key] ?? []
    if (!map[key].some((item) => item.gender === match[1].toUpperCase() && item.rating === match[2] && item.slope === match[3])) {
      map[key].push({ gender: match[1].toUpperCase(), rating: match[2], slope: match[3] })
    }
  }
  return map
}

function shiftRating(map: Record<string, Array<{ gender: string; rating: string; slope: string }>>, name: string, gender: string, seenByGender: Record<string, number>) {
  const key = normalizeLabel(name)
  const options = (map[key] ?? []).filter((item) => item.gender === gender)
  const seenKey = `${gender}:${key}`
  const index = seenByGender[seenKey] ?? 0
  seenByGender[seenKey] = index + 1
  return options[index] ?? options[0]
}

function parseScorecardSummary(html: string) {
  const summary: Record<string, string> = {}
  for (const item of html.matchAll(/<li[^>]*>\s*<span>([^<]*)<\/span>\s*<p>([^<]*)<\/p>\s*<\/li>/gi)) {
    summary[normalizeLabel(item[2])] = textFromHtml(item[1])
  }
  return {
    yardage: summary.yards ?? '',
    rating: summary.rating ?? '',
    slope: summary.slope ?? '',
  }
}

function numberAt(row: string[] | undefined, index: number) {
  const value = Number(row?.[index]?.replace(/[^\d.-]/g, ''))
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function sumNumbers(row: string[], indexes: number[]) {
  return indexes.reduce((sum, index) => sum + (numberAt(row, index) ?? 0), 0)
}

function normalizeLabel(value: string) {
  return textFromHtml(value)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9/]+/g, ' ')
    .trim()
}

function slugify(value: string) {
  return normalizeLabel(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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
