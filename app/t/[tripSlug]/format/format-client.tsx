'use client'

import { useState, type ReactNode } from 'react'

type CourseInfo = {
  id: string
  name: string
  dayNumber: number
  teeName: string | null
  rating: number | null
  slope: number | null
  teeOptions: unknown
} | null

type RoundInfo = {
  id: string
  roundNumber: number
  format: string
  formatLabel: string
  handicapAllowance: number
  status: string
  course: CourseInfo
}

export function FormatClient({ rounds, tripName }: { rounds: RoundInfo[]; tripName: string }) {
  const tabs = ['Handicap', ...rounds.map((r) => `Round ${r.roundNumber}`)]
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-1">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`shrink-0 rounded-2xl px-4 py-2 text-xs font-black transition-colors ${activeTab === i ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 0 && <HandicapTab tripName={tripName} rounds={rounds} />}
      {rounds.map((round, i) => activeTab === i + 1 ? <RoundTab key={round.id} round={round} /> : null)}
    </div>
  )
}

// ─── Handicap tab ─────────────────────────────────────────────────────────────

function HandicapTab({ rounds }: { tripName: string; rounds: RoundInfo[] }) {
  return (
    <div className="space-y-3">
      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title="How strokes are assigned" />
        <div className="mt-3 space-y-3 text-sm font-semibold text-slate-600">
          <Step n={1} title="Course handicap">
            Your handicap index is adjusted for the difficulty of the course you&apos;re playing. A harder course (higher slope) gives you more strokes.
            <Formula>Course handicap = Index × (Slope ÷ 113)</Formula>
            For example, a 12-handicap on a course with slope 125 gets <strong>13 strokes</strong> (12 × 125/113 ≈ 13.3, rounded down).
          </Step>

          <Step n={2} title="Format allowance">
            Different formats apply a percentage allowance to keep the game competitive. Four-ball uses 90%, singles uses 100%, alt-shot uses 50%.
            <Formula>Playing handicap = Course handicap × Allowance %</Formula>
            The same 13-stroke player in a four-ball match (90%) plays off <strong>11 strokes</strong>.
          </Step>

          <Step n={3} title="Stroke allocation on the card">
            Strokes are given on the hardest holes first. Hole stroke index 1 is the hardest, stroke index 18 is the easiest.
            A player with 5 strokes gets one stroke on the holes ranked 1 through 5. A player with 20 strokes gets two strokes on holes ranked 1 and 2, one stroke on holes 3 through 18.
          </Step>

          <Step n={4} title="Head-to-head adjustment">
            In match play, the lowest handicap player in the match plays off scratch (zero strokes). All other players receive strokes equal to the difference.
            <Formula>Player strokes = Player handicap − Lowest handicap in match</Formula>
            If Blue A plays off 8 and Red B plays off 14, Red B gets 6 strokes (14 − 8) on the six hardest holes.
          </Step>
        </div>
      </section>

      {rounds.some((r) => r.course?.rating && r.course?.slope) ? (
        <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <SectionTitle title="Course adjustments this trip" />
          <div className="mt-3 space-y-3">
            {rounds.map((round) => {
              if (!round.course?.rating || !round.course?.slope) return null
              const allowance = round.handicapAllowance / 100
              const exampleIndex = 14
              const courseHcp = Math.round(exampleIndex * (round.course.slope / 113))
              const playingHcp = Math.round(courseHcp * allowance)
              return (
                <div key={round.id} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Round {round.roundNumber} — {round.course.name}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Rating {round.course.rating} · Slope {round.course.slope} · {round.handicapAllowance}% allowance
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Example (HCP {exampleIndex}): course HCP = {courseHcp}, playing HCP = {playingHcp} strokes
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title="Tee selection and adjustments" />
        <div className="mt-3 space-y-3 text-sm font-semibold text-slate-600">
          <p>If players choose different tees, each player&apos;s course handicap is calculated using the rating and slope of their chosen tee, not the default tee.</p>
          <p>This means a player on the senior tees (lower slope, lower rating) will receive fewer strokes than a player on the back tees, which fairly represents the difference in course difficulty.</p>
          {rounds.some((r) => r.course) ? (
            <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Available tees</p>
              {rounds.map((round) => {
                if (!round.course) return null
                const tees = getTeeOptions(round.course)
                return (
                  <div key={round.id} className="mt-2">
                    <p className="text-xs font-semibold text-slate-500">Round {round.roundNumber} — {round.course.name}</p>
                    {tees.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {tees.map((tee) => (
                          <span key={tee.name} className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                            {tee.name}{tee.rating ? ` ${tee.rating}/${tee.slope}` : ''}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Default tee only</p>
                    )}
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}

// ─── Round tab ────────────────────────────────────────────────────────────────

function RoundTab({ round }: { round: RoundInfo }) {
  const allowancePct = round.handicapAllowance
  const formatModule = getFormatMeta(round.format)

  return (
    <div className="space-y-3">
      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Round {round.roundNumber}</p>
            <h2 className="mt-1 text-2xl font-black">{round.formatLabel}</h2>
          </div>
          <div className="shrink-0 text-right">
            <span className="rounded-2xl bg-emerald-100 px-3 py-1.5 text-sm font-black text-emerald-800">
              {allowancePct}% allowance
            </span>
            <p className="mt-1 text-xs text-slate-400">{round.status.replace(/_/g, ' ')}</p>
          </div>
        </div>

        {round.course ? (
          <div className="mt-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Course</p>
            <p className="mt-1 font-black">{round.course.name}</p>
            {round.course.rating && round.course.slope ? (
              <p className="text-sm text-slate-500">
                {round.course.teeName ?? 'Default'} tees · Rating {round.course.rating} · Slope {round.course.slope}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title="How it works" />
        <ul className="mt-3 space-y-2">
          {formatModule.rules.map((rule) => (
            <li key={rule} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{rule}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title="Handicap mechanics" />
        <div className="mt-3 space-y-2 text-sm font-semibold text-slate-600">
          <p>{formatModule.handicapMechanics}</p>
          <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Allowance: {allowancePct}%</p>
            <p className="mt-1 text-sm text-slate-600">{formatModule.allowanceExplanation(allowancePct)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title="Scoring" />
        <ul className="mt-3 space-y-2">
          {formatModule.scoring.map((item) => (
            <li key={item} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{item}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// ─── Format metadata ──────────────────────────────────────────────────────────

type FormatMeta = {
  rules: string[]
  handicapMechanics: string
  allowanceExplanation: (pct: number) => string
  scoring: string[]
}

function getFormatMeta(format: string): FormatMeta {
  switch (format) {
    case 'FOUR_BALL':
      return {
        rules: [
          'Each player plays their own ball throughout the hole.',
          'On each hole, each side counts the better net score between its two players.',
          'The lower better-ball net score wins the hole.',
          'A match is 18 holes, worth 1 point. A half (tied match) earns 0.5 points per side.',
          'Each side has two players — typically one from Team Blue and one from Team Red.',
        ],
        handicapMechanics: 'Each player receives individual strokes based on their handicap, applied to their personal net score. Within a match, strokes are relative to the lowest handicap player.',
        allowanceExplanation: (pct) =>
          `At ${pct}% allowance, a 20-handicap player on a slope-113 course plays off ${Math.round(20 * pct / 100)} strokes (20 × ${pct}%). The lower net score from the two-player side wins each hole.`,
        scoring: [
          'Win a hole: lower better-ball net.',
          'Tie a hole: halved — no change in match standing.',
          'Win the match: be up at the end of 18 holes.',
          'Concede a hole: opponent wins that hole.',
        ],
      }

    case 'SINGLES':
      return {
        rules: [
          'One player from each team plays a direct head-to-head match.',
          'The lower handicap player in the match plays off zero.',
          'The higher handicap player receives the difference on the hardest holes.',
          'The match is decided hole by hole — lowest net score wins each hole.',
          'Each match is worth 1 point. A halved match earns 0.5 points each.',
        ],
        handicapMechanics: 'Strokes are the difference between the two players\' handicaps. If Player A is 8 and Player B is 14, Player B gets 6 strokes (14 − 8). A plays off scratch.',
        allowanceExplanation: (pct) =>
          `At ${pct}% allowance, the handicap difference between players is multiplied by ${pct}% before allocating strokes. Example: a 10-stroke difference becomes ${Math.round(10 * pct / 100)} strokes.`,
        scoring: [
          'Win a hole: lower net score on that hole.',
          'Halve a hole: both players same net — no change.',
          'Match result: most holes won, or "X & Y" (e.g., 3&2 = 3 up with 2 to play).',
          '1 point for a match win, 0.5 for a halved match.',
        ],
      }

    case 'ALT_SHOT':
      return {
        rules: [
          'Two-player teams alternate hitting the same ball on every shot.',
          'One player tees off on odd-numbered holes, the other on even-numbered holes.',
          'The alternating order is fixed — you can\'t choose who hits based on position.',
          'The team\'s net score wins or loses the hole against the opposing team.',
          'A halved match earns 0.5 points per side.',
        ],
        handicapMechanics: 'Alt-shot uses a combined team handicap. Add the two players\' handicaps, apply the 50% allowance (combined / 2), then use that as a single stroke total.',
        allowanceExplanation: (pct) =>
          `At ${pct}% allowance, a team of a 10-HCP and a 16-HCP player has a combined handicap of 26, giving ${Math.round(26 * pct / 100)} team strokes after the ${pct}% reduction.`,
        scoring: [
          'Hole winner: lower net team score.',
          'Match winner: most holes won after 18.',
          '1 point for a win, 0.5 for a draw.',
          'Team strokes are allocated to the hardest holes by stroke index.',
        ],
      }

    case 'SCRAMBLE':
      return {
        rules: [
          'Every player on the team hits a tee shot.',
          'The team picks the best shot. All players hit from that spot.',
          'Repeat until the ball is holed.',
          'Team score is the total for the round.',
          'No head-to-head matchups — teams compete on gross score.',
        ],
        handicapMechanics: 'Scramble uses a blended team handicap. A common formula: 20% of the lowest + 15% of second + 10% of third + 5% of fourth player handicap.',
        allowanceExplanation: (pct) =>
          `At ${pct}% allowance, the blended team handicap is further reduced to reflect the advantage of always hitting from the best position.`,
        scoring: [
          'Lower gross score wins the round.',
          'The leaderboard ranks teams by total strokes.',
          'Ties are broken by back-nine score.',
        ],
      }

    case 'SHAMBLE':
      return {
        rules: [
          'Every player hits a tee shot.',
          'The team picks the best drive. All players play their own ball from that spot.',
          'Players finish the hole individually.',
          'The best net score from any player on the team counts.',
        ],
        handicapMechanics: 'Each player receives individual strokes based on their own handicap, applied to their personal score after the shared drive.',
        allowanceExplanation: (pct) =>
          `At ${pct}% allowance, each player's full playing handicap is used for their net score. The team uses the best of these on each hole.`,
        scoring: [
          'Each hole: lowest net score among all team members counts.',
          'Leaderboard tracks cumulative team net score.',
          'Lower total wins.',
        ],
      }

    case 'STABLEFORD':
      return {
        rules: [
          'Players earn points per hole instead of just counting total strokes.',
          '2 points for par, 1 point for bogey, 3 points for birdie, 4 for eagle.',
          'Double bogey or worse = 0 points (pick up and move on).',
          'Net scores are used — your handicap strokes reduce your score before calculating points.',
        ],
        handicapMechanics: 'Each player receives strokes by hole stroke index. Net your score first, then apply the points table. A net par earns 2 points.',
        allowanceExplanation: (pct) =>
          `At ${pct}% allowance, playing handicap = course handicap × ${pct}%. Strokes are still allocated by stroke index from hardest hole down.`,
        scoring: [
          'Bogey net: 1 pt · Par net: 2 pts · Birdie net: 3 pts · Eagle net: 4 pts',
          'Double bogey or worse: 0 pts (pick up).',
          'Higher total wins — you want the most points.',
          'The leaderboard ranks players or teams by total Stableford points.',
        ],
      }

    case 'STROKE_BLIND':
      return {
        rules: [
          'Full stroke play — every player posts a complete 18-hole score.',
          'Pairings are not announced in advance.',
          'After the round, pairings are revealed and match results are calculated.',
          'Each post-hoc match is worth 1 point.',
        ],
        handicapMechanics: 'Handicap strokes are applied normally after the round. Net scores determine who wins each revealed matchup.',
        allowanceExplanation: (pct) =>
          `At ${pct}% allowance, each player's playing handicap determines net score for the post-round matchup comparison.`,
        scoring: [
          'Post-round: net score lower than opponent wins the match.',
          '1 point for a win, 0.5 for a tie.',
          'A leaderboard also shows gross and net totals.',
        ],
      }

    default:
      return {
        rules: [
          'Full stroke play — every player posts a complete round score.',
          'Gross and net leaderboards update in real time as scores are entered.',
        ],
        handicapMechanics: 'Standard stroke play handicap. Playing handicap = course handicap × allowance.',
        allowanceExplanation: (pct) => `${pct}% of course handicap is used as the playing handicap.`,
        scoring: ['Lower gross or net score is better.', 'Leaderboard is sorted by net score.'],
      }
  }
}

// ─── Helper components ────────────────────────────────────────────────────────

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">{n}</div>
      <div className="min-w-0">
        <p className="font-black text-slate-950">{title}</p>
        <div className="mt-1 space-y-1 text-slate-600">{children}</div>
      </div>
    </div>
  )
}

function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="my-1 rounded-xl bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 ring-1 ring-slate-200">
      {children}
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">{title}</h2>
}

type TeeOption = { name: string; rating?: string | number | null; slope?: string | number | null }

function getTeeOptions(course: NonNullable<CourseInfo>): TeeOption[] {
  if (!Array.isArray(course.teeOptions)) return course.teeName ? [{ name: course.teeName, rating: course.rating, slope: course.slope }] : []
  const options: TeeOption[] = course.teeOptions.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const rec = item as Record<string, unknown>
    const name = typeof rec.name === 'string' ? rec.name : ''
    if (!name) return []
    return [{ name, rating: rec.rating as string | number | null, slope: rec.slope as string | number | null }]
  })
  if (!options.length && course.teeName) return [{ name: course.teeName, rating: course.rating, slope: course.slope }]
  return options
}
