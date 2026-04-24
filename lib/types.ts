export type TripRole = 'OWNER' | 'ADMIN' | 'PLAYER' | 'SPECTATOR'

export type TripStatus = 'DRAFT' | 'REGISTRATION' | 'TEAMS_READY' | 'LIVE' | 'COMPLETE'

export type TripSummary = {
  slug: string
  name: string
  dates: string
  location: string
  status: TripStatus
  playerCount: number
  maxPlayers: number
  formats: string[]
}

export type TripLink = {
  label: string
  href: string
  role: TripRole
  description: string
}

export type RulesMode = 'USGA' | 'RELAXED'

export type ScoreMax = 'NONE' | 'DOUBLE_BOGEY' | 'TRIPLE_BOGEY' | 'NET_DOUBLE_BOGEY'

export type TeamMethod = 'BALANCED_AUTO' | 'CAPTAINS_PICK' | 'MANUAL' | 'RANDOM'

export type PairingMethod = 'RULE_BASED' | 'MANUAL' | 'RANDOM'

export type TripTemplateId = 'RYDER_CUP_WEEKEND' | 'SCRAMBLE_OUTING' | 'STROKE_PLAY_TRIP' | 'CUSTOM'

export type FormatOption = {
  id: string
  name: string
  description: string
  matchPlay: boolean
}

export type CourseDraft = {
  day: number
  name: string
  teeName: string
  rating: string
  slope: string
  source?: 'manual' | 'golfcourseapi' | 'bluegolf'
  sourceId?: string
  blueGolfUrl?: string
}

export type TripSetupDraft = {
  ownerName: string
  ownerEmail: string
  adminToken: string
  tripName: string
  slug: string
  templateId: TripTemplateId
  playerCount: number
  dayCount: number
  roundCount: number
  formats: string[]
  rulesMode: RulesMode
  scoreMax: ScoreMax
  teamMethod: TeamMethod
  pairingMethod: PairingMethod
  courses: CourseDraft[]
}
