import type { FormatOption, TripLink, TripSetupDraft, TripSummary, TripTemplateId } from './types'

export const trips: TripSummary[] = [
  {
    slug: 'richmond-open-2026',
    name: 'The Richmond Open',
    dates: 'May 15-17, 2026',
    location: 'Richmond, VA',
    status: 'LIVE',
    playerCount: 16,
    maxPlayers: 16,
    formats: ['2v2 Best Ball', 'Blind Stroke Matches', 'Singles'],
  },
  {
    slug: 'pinehurst-boys-trip',
    name: 'Pinehurst Boys Trip',
    dates: 'Oct 2-5, 2026',
    location: 'Pinehurst, NC',
    status: 'REGISTRATION',
    playerCount: 9,
    maxPlayers: 20,
    formats: ['Scramble', 'Four-Ball', 'Singles'],
  },
]

export function getTrip(slug: string) {
  return trips.find((trip) => trip.slug === slug) ?? createDraftTrip(slug)
}

export function getTripLinks(slug: string): TripLink[] {
  return [
    {
      label: 'Admin',
      href: `/t/${slug}/admin`,
      role: 'OWNER',
      description: 'Configure teams, rounds, pairings, scoring rules, and reset tools.',
    },
    {
      label: 'Lobby',
      href: `/t/${slug}/lobby`,
      role: 'PLAYER',
      description: 'Trip waiting room, roster, team assignments, and live navigation.',
    },
    {
      label: 'Player',
      href: `/t/${slug}/player`,
      role: 'PLAYER',
      description: 'Personal scoring card and live match state.',
    },
    {
      label: 'Format',
      href: `/t/${slug}/format`,
      role: 'PLAYER',
      description: 'Trip-specific game explanations and scoring rules.',
    },
  ]
}

export const formatOptions: FormatOption[] = [
  {
    id: 'FOUR_BALL',
    name: '2v2 Best Ball / Four-Ball',
    description: 'Each player plays their ball. Side uses the better net score on each hole.',
    matchPlay: true,
  },
  {
    id: 'SINGLES',
    name: 'Singles Match Play',
    description: 'One player vs one player, hole by hole.',
    matchPlay: true,
  },
  {
    id: 'STROKE_BLIND',
    name: 'Individual Stroke Play + Blind Matches',
    description: 'Players post full rounds, then hidden head-to-head results are revealed.',
    matchPlay: false,
  },
  {
    id: 'ALT_SHOT',
    name: 'Alternate Shot / Foursomes',
    description: 'Partners alternate shots on one team ball.',
    matchPlay: true,
  },
  {
    id: 'SCRAMBLE',
    name: 'Scramble',
    description: 'Team chooses the best shot and everyone plays from there.',
    matchPlay: false,
  },
  {
    id: 'SHAMBLE',
    name: 'Shamble',
    description: 'Team picks the best drive, then each player finishes their own ball.',
    matchPlay: false,
  },
  {
    id: 'STABLEFORD',
    name: 'Stableford',
    description: 'Players earn points per hole instead of counting total strokes.',
    matchPlay: false,
  },
]

export const tripTemplates: Array<{
  id: TripTemplateId
  name: string
  description: string
  setup: Pick<TripSetupDraft, 'playerCount' | 'dayCount' | 'roundCount' | 'formats' | 'rulesMode' | 'scoreMax' | 'teamMethod' | 'pairingMethod'>
}> = [
  {
    id: 'RYDER_CUP_WEEKEND',
    name: 'Ryder Cup Weekend',
    description: 'Team match play across best ball, stroke/blind matches, and singles.',
    setup: {
      playerCount: 16,
      dayCount: 3,
      roundCount: 3,
      formats: ['FOUR_BALL', 'STROKE_BLIND', 'SINGLES'],
      rulesMode: 'RELAXED',
      scoreMax: 'TRIPLE_BOGEY',
      teamMethod: 'BALANCED_AUTO',
      pairingMethod: 'RULE_BASED',
    },
  },
  {
    id: 'SCRAMBLE_OUTING',
    name: 'Scramble Outing',
    description: 'One-day low-friction outing with team scramble scoring.',
    setup: {
      playerCount: 24,
      dayCount: 1,
      roundCount: 1,
      formats: ['SCRAMBLE'],
      rulesMode: 'RELAXED',
      scoreMax: 'DOUBLE_BOGEY',
      teamMethod: 'RANDOM',
      pairingMethod: 'RANDOM',
    },
  },
  {
    id: 'STROKE_PLAY_TRIP',
    name: 'Stroke Play Trip',
    description: 'Multi-day individual leaderboard with optional team rollup.',
    setup: {
      playerCount: 12,
      dayCount: 3,
      roundCount: 3,
      formats: ['STROKE_BLIND'],
      rulesMode: 'USGA',
      scoreMax: 'NET_DOUBLE_BOGEY',
      teamMethod: 'MANUAL',
      pairingMethod: 'MANUAL',
    },
  },
  {
    id: 'CUSTOM',
    name: 'Custom',
    description: 'Start simple and choose every format and rule yourself.',
    setup: {
      playerCount: 16,
      dayCount: 3,
      roundCount: 3,
      formats: [],
      rulesMode: 'RELAXED',
      scoreMax: 'TRIPLE_BOGEY',
      teamMethod: 'BALANCED_AUTO',
      pairingMethod: 'RULE_BASED',
    },
  },
]

export function createDefaultSetup(slug: string, ownerName = '', tripName = ''): TripSetupDraft {
  const template = tripTemplates[0]
  return {
    ownerName,
    ownerEmail: '',
    adminToken: createAdminToken(),
    tripName: tripName || titleFromSlug(slug),
    slug,
    templateId: template.id,
    ...template.setup,
    courses: createCoursesForSetup(template.setup.dayCount, template.setup.roundCount),
  }
}

export function createCoursesForDays(dayCount: number, existing: TripSetupDraft['courses'] = []) {
  return Array.from({ length: dayCount }, (_, index) => existing[index] ?? {
    day: index + 1,
    name: '',
    teeName: '',
    rating: '',
    slope: '',
    source: 'manual' as const,
  })
}

export function createCoursesForSetup(dayCount: number, roundCount: number, existing: TripSetupDraft['courses'] = []) {
  return createCoursesForDays(Math.min(dayCount, roundCount), existing)
}

function createDraftTrip(slug: string): TripSummary {
  return {
    slug,
    name: titleFromSlug(slug),
    dates: 'Dates to be set',
    location: 'Location to be set',
    status: 'DRAFT',
    playerCount: 0,
    maxPlayers: 16,
    formats: ['Setup underway'],
  }
}

function titleFromSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function createAdminToken() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
}
