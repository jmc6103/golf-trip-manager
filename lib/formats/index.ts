import type { RoundFormat } from '@prisma/client'
import type { FormatModule } from './types'
import { fourBall } from './four-ball'
import { singles } from './singles'
import { strokeBlind } from './stroke-blind'
import { altShot } from './alt-shot'
import { scramble } from './scramble'
import { shamble } from './shamble'
import { stableford } from './stableford'

export type { FormatModule, PairingConstraint } from './types'

export const formatRegistry: Record<RoundFormat, FormatModule> = {
  FOUR_BALL: fourBall,
  SINGLES: singles,
  STROKE_BLIND: strokeBlind,
  ALT_SHOT: altShot,
  SCRAMBLE: scramble,
  SHAMBLE: shamble,
  STABLEFORD: stableford,
}

export function getFormat(format: RoundFormat | string): FormatModule {
  return formatRegistry[format as RoundFormat] ?? strokeBlind
}
