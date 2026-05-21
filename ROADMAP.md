# Golf Trip Manager — Roadmap

## What This Is

Two codebases exist today:

**golf-trip-app** — a one-time-use app built for a specific event ("The Richmond Open"). Hardcoded: trip name, 3 specific VA courses, 16 named players, a fixed 3-day format. What it got right: sophisticated smart pairing (DFS-optimized, avoids repeat opponents across rounds), USGA sandbagger analysis, break glass admin tools, per-player tee selection, and event notifications.

**golf-trip-manager** (this repo) — a multi-tenant wrapper around that concept. Better architecture: slug-based isolation, 7 scoring formats, trip templates, course search (BlueGolf + GolfCourseAPI), configurator UI, and an invitation system. What it's missing: most of golf-trip-app's functional depth.

This document charts two parallel tracks:
1. **Complete the internals** — port what golf-trip-app does well into this repo
2. **Modularize** — restructure so adding a new format or pairing strategy is one new file, not surgery across five existing ones

---

## Workstream Split

Work is divided into two independent streams that can run simultaneously. Neither blocks the other from starting or finishing.

### Workstream A — Claude
**Theme: Logic refactoring and pure-function work.** All items are pure TypeScript changes to `lib/` — no new DB models required. Deep familiarity with the existing scoring and ops patterns is critical here.

| Step | Task |
|------|------|
| ~~A-1~~ ✅ | Format modules (`lib/formats/`) |
| ~~A-2~~ ✅ | Pairing strategies (`lib/pairing/`) |
| ~~A-3~~ ✅ | Smart pairing engine (port from golf-trip-app) |
| ~~A-4~~ ✅ | Handicap allowance per round (wire `Round.handicapAllowance`) |
| ~~A-5~~ ✅ | Sandbagger analysis (`lib/sandbagger.ts` + admin panel section) |
| ~~A-6~~ ✅ | Leaderboard enhancements (cumulative standings, stroke play table, individual stats) |

A-1 is foundational for A-3 and A-6. A-2 is foundational for A-3. A-4 and A-5 are self-contained and can run in parallel with A-1/A-2.

### Workstream B — ChatGPT Codex
**Theme: Schema additions and additive CRUD features.** All items extend the DB and add new UI/API surfaces. No changes to existing scoring logic — work within defined boundaries.

| Step | Task |
|------|------|
| B-1 | Schema additions (all 4 new models + Match void fields + HoleScore index) |
| B-2 | AdminIdentity role enforcement |
| B-3 | RoundSubmission wiring |
| B-4 | Per-player tee selection (needs B-1) |
| B-5 | Admin break glass tools (needs B-1) |
| B-6 | Live notifications (needs B-1) |

B-1 must go first. B-2 and B-3 are independent of B-1 and can run in parallel with it. B-4, B-5, B-6 depend on B-1.

### Merge Coordination Points

Two files are touched by both workstreams. Coordinate before merging:

- **`lib/scoring.ts`** — A-1 refactors allowance constants; B-4 adds tee-selection parameter to `getPlayerHandicap()`. Keep changes in separate function signatures; they don't overlap.
- **`app/t/[tripSlug]/admin/admin-control-room.tsx`** — A-5 adds a "Handicap Integrity" section; B-4 adds tee selectors; B-5 adds break glass panel. Each adds a new `<section>` at the bottom — append-only, no overlapping edits.

---

## Coding Conventions

Follow these patterns consistently across both workstreams. They reflect existing patterns in the codebase — not new rules.

### TypeScript

- **No `any`**. Use `unknown` and narrow, or extend types from `lib/types.ts`. If a Prisma query result shape is complex, derive the type with `Prisma.XxxGetPayload<typeof query>`.
- **Pure functions stay pure**. Anything in `lib/scoring.ts`, `lib/sandbagger.ts`, or `lib/formats/` must never import from `lib/db.ts`. If it touches the DB, it doesn't belong there.
- **Use existing Prisma enums directly** — `RoundFormat`, `RoundStatus`, `TripStatus`, etc. are exported from `@prisma/client`. Don't re-declare them as string unions in `lib/types.ts`.
- **Prefer `const` assertions for lookup tables** (USGA frequency table, format registry). Avoids accidental mutation and makes TypeScript infer literal types.

### API Routes

- **Auth check is always first** — `hasAdminAccess(slug)` for admin routes, `getPlayerFromCookie(slug)` for player routes — before any DB access. Return `401`/`403` immediately if it fails.
- **All admin mutations go through the existing `api/admin/ops/route.ts`** — POST for actions (verbs like `void-match`, `override-score`), PATCH for resource updates (nouns like `match-side`, `team`). Don't add new route files for admin ops.
- **Always guard on `DATABASE_URL`** — follow the pattern in `lib/tenant-data.ts`: if no DB, return a graceful empty/null response rather than throwing.
- **Response shape is always `NextResponse.json(data)`** for success and `NextResponse.json({ error: 'message' }, { status: N })` for errors. No other shapes.

### Database

- **DB access belongs in three places only**: `lib/tenant-data.ts` (auth + trip CRUD), `lib/trip-view-data.ts` (read-heavy assemblers), `lib/trip-ops.ts` (write-heavy mutations). Never import `lib/db.ts` directly in a route or component.
- **Use `db.$transaction([...])` for multi-write ops** — team generation (creates Team + TeamPlayer rows), break glass score override (writes HoleScore + AdminAction), handicap adjustment (writes Player + HandicapAdjustment). Atomicity prevents half-written state.
- **Schema is additive** — no field removals, no type changes, no renames. New optional fields (`DateTime?`, `String?`) are safe to add without a migration guard. New required fields need a default.
- **After any schema change**: run `npm run db:generate` to regenerate the Prisma client before writing any code that uses the new fields.

### Components

- **`'use client'` only on components that use `useState`, `useEffect`, or browser event handlers**. Prefer server components for data display. The existing split (server page → client `*-board.tsx` / `*-scorecard.tsx`) is the pattern to follow.
- **Don't fetch in components** — all data flows through the `api/` routes so they remain independently callable. Server pages pass fetched data as props to client components.
- **New admin UI sections append to the bottom of `admin-control-room.tsx`** as a new `<section>` block. Don't restructure existing sections.

### Format Modules (Workstream A specific)

- Each format file exports a single `const module: FormatModule` — no default export, named export only for tree-shaking safety.
- `computeHoleResult` and `buildLeaderboardRows` must be **referentially transparent** — same inputs always produce same output, no closures over external state.
- The registry in `lib/formats/index.ts` is the single source of truth for what formats exist. The configurator, scoring engine, and leaderboard all call `getFormat(format)` — never switch on a format string anywhere else in the codebase.

### Break Glass Tools (Workstream B specific)

- Every break glass write (score override, match void, handicap adjustment) must create an `AdminAction` record in the same `db.$transaction()`. No exceptions. This is the audit trail.
- Admin ops that void or override **do not delete** the original data — they mark it (set `voidedAt`, set `overriddenBy`). The original score stays for audit purposes.
- Force-finalize treats missing hole scores as the `ScoreMax` value for that round (not zero, not par). Look up `round.scoreMax` and apply accordingly.

---

## Current State

### Working Today
- Multi-tenant trip creation and configuration (slug-based)
- Player registration and cookie-based auth (admin hash + player token)
- Team generation: `BALANCED_AUTO` and `RANDOM` methods
- Match generation for all 7 formats (`FOUR_BALL`, `SINGLES`, `STROKE_BLIND`, `ALT_SHOT`, `SCRAMBLE`, `SHAMBLE`, `STABLEFORD`)
- Hole-by-hole scoring with `ScoreMax` enforcement
- Live team board with 4-second auto-refresh
- Player scorecard with match status timeline
- Round lifecycle: start → finalize → reset
- Admin ops: team assignment, match-side editing, team rename
- Course data entry (manual + BlueGolf scraper + GolfCourseAPI search)
- Trip templates: `RYDER_CUP_WEEKEND`, `SCRAMBLE_OUTING`, `STROKE_PLAY_TRIP`, `CUSTOM`

### Known Rough Edges
- `AdminIdentity.role` (OWNER / ADMIN / PLAYER) is stored but never checked — all admin ops accept any valid admin cookie
- `RoundSubmission.submittedAt` is never set; `getPlayerCardData()` hardcodes it as `null`
- Match generation is random — no handicap-gap balancing, no opponent-history tracking
- No per-player tee selection (scoring uses a single course tee for everyone)
- `CAPTAINS_PICK` team method is a DB enum value with no UI or logic
- Leaderboard shows only the current round; no cumulative standings view
- No sandbagger or handicap adjustment tooling
- No admin break glass tools (void a match, override a score, force-finalize)

---

## Workstream A — Claude

### A-1. Format Modules
> **Foundational. Complete before A-3 and A-6.**

Today's scoring and match logic is scattered across three files with format-specific `if/switch` branches:
- `lib/scoring.ts` — handicap allowances hardcoded per format
- `lib/trip-ops.ts` — `generateMatchesForTrip()` has per-format branching for player counts
- `lib/trip-data.ts` — format labels and descriptions

Adding a new format (e.g. "Wolf", "Skins", "Nassau") today means editing all three files.

**What to build:**

```
lib/formats/
  types.ts          — FormatModule interface + HoleResult, LeaderboardRow, MatchPairing types
  index.ts          — format registry: Record<RoundFormat, FormatModule> + getFormat() lookup
  four-ball.ts
  singles.ts
  stroke-blind.ts
  alt-shot.ts
  scramble.ts
  shamble.ts
  stableford.ts
```

**FormatModule interface** (`lib/formats/types.ts`):
```typescript
export interface FormatModule {
  format: RoundFormat
  label: string
  description: string

  handicapAllowance: number       // default; Round.handicapAllowance overrides this
  defaultScoreMax: ScoreMax
  isMatchPlay: boolean
  isTeamFormat: boolean
  playersPerSide: 1 | 2 | 4

  computeHoleResult(
    sideA: PlayerHoleScore[],
    sideB: PlayerHoleScore[],
    hole: Hole
  ): HoleResult

  buildLeaderboardRows(matchData: MatchData[]): LeaderboardRow[]

  pairingConstraints?: PairingConstraint[]
  generateMatches?(
    players: Player[],
    teams: Team[],
    round: Round,
    history: MatchHistory
  ): MatchPairing[]
}
```

**Changes to existing files after modules exist:**
- `lib/scoring.ts` — remove hardcoded allowance constants; call `getFormat(round.format).handicapAllowance`
- `lib/trip-ops.ts` — `generateMatchesForTrip()` delegates to `format.generateMatches()` if defined
- `lib/trip-data.ts` — remove `FORMAT_OPTIONS` array; derive from format registry at runtime
- `admin-configurator.tsx` — format picker reads from registry, not hardcoded list
- `team-board.tsx` — leaderboard calls `format.buildLeaderboardRows()` to choose layout

**Files touched:** `lib/formats/` (new), `lib/scoring.ts`, `lib/trip-ops.ts`, `lib/trip-data.ts`, `app/t/[tripSlug]/admin/admin-configurator.tsx`, `app/t/[tripSlug]/team/team-board.tsx`

---

### A-2. Pairing Strategies
> **Complete before A-3.**

```
lib/pairing/
  types.ts          — PairingStrategy interface + MatchHistory, MatchPairing types
  index.ts          — strategy registry + getStrategy() lookup
  rule-based.ts     — port of golf-trip-app DFS optimizer
  random.ts         — current default behavior extracted
  manual.ts         — passthrough (admin assigns sides via PATCH)
  captains-pick.ts  — stub; UI flow deferred (see note below)
```

**PairingStrategy interface** (`lib/pairing/types.ts`):
```typescript
export interface PairingStrategy {
  method: PairingMethod
  generatePairings(
    players: Player[],
    teams: Team[],
    format: FormatModule,
    history: MatchHistory
  ): MatchPairing[]
}

export interface MatchHistory {
  // maps playerId → set of playerIds they've been matched against
  opponents: Map<number, Set<number>>
  // maps playerId → set of playerIds on their own side
  partners: Map<number, Set<number>>
}
```

`Round.pairingMethod` selects the strategy. Changing pairing behavior = change one field in the configurator.

**Files touched:** `lib/pairing/` (new), `lib/trip-ops.ts`

---

### A-3. Smart Pairing Engine
> **Port from `golf-trip-app/lib/matches.ts`. Requires A-1 and A-2.**

golf-trip-app's DFS pairing optimizer:
- Minimizes handicap gaps within each match
- Tracks opponent history across rounds; penalizes rematches
- Propagates constraints forward (Round 3 avoids Round 1 + Round 2 opponents)
- Falls back to random if the constraint graph is unsatisfiable

**What to build:**
- `lib/pairing/rule-based.ts` — port the DFS logic from golf-trip-app. The key function is `generatePairings()` satisfying the `PairingStrategy` interface.
- Build `MatchHistory` from existing `Match` + `MatchPlayer` records before calling the strategy
- `lib/trip-ops.ts`: `generateMatchesForTrip()` builds history and passes it to `getStrategy(round.pairingMethod).generatePairings(...)`

**Files touched:** `lib/pairing/rule-based.ts`, `lib/trip-ops.ts`

---

### A-4. Handicap Allowance Per Round
> **Self-contained. Can run in parallel with A-1/A-2.**

`Round.handicapAllowance` already exists in the schema as a `Float`. Today it's never written or read — the scoring engine uses hardcoded values.

**What to build:**
- `admin-configurator.tsx`: write `handicapAllowance` when creating/editing a round (pre-fill from `getFormat(format).handicapAllowance`, make it editable)
- `lib/scoring.ts`: in `getNetScore()`, read `round.handicapAllowance ?? getFormat(round.format).handicapAllowance`

This is a small change but unlocks per-trip format customization.

**Files touched:** `lib/scoring.ts`, `app/t/[tripSlug]/admin/admin-configurator.tsx`

---

### A-5. Sandbagger & Handicap Analysis
> **Port from `golf-trip-app/lib/sandbagger.ts`. Self-contained. No DB changes.**

A USGA-based statistical consistency checker. For each completed round, computes a player's net differential and looks up its probability in a frequency table keyed by handicap band. Outputs: **Sandbagger** / **Sounds about right** / **Bum**.

**What to build:**
- New file `lib/sandbagger.ts` — pure functions only, zero DB imports:
  - `getHandicapBand(handicap: number): number` — maps to one of 8 USGA bands (0-4.9, 5-9.9, ..., 35-39.9)
  - `getUSGAOdds(netDelta: number, band: number): number` — frequency table lookup
  - `getSandbaggerAssessment(player, round, scores): { flag: 'SANDBAGGER' | 'SOUNDS_ABOUT_RIGHT' | 'BUM', netDelta: number, odds: number }`
  - `getNetDifferential(grossScore, courseRating, courseSlope, handicap): number`
- `lib/trip-view-data.ts`: add `getSandbaggerSummary(tripSlug)` that calls `getSandbaggerAssessment` for each player/round combo and returns structured results
- `admin-control-room.tsx`: new "Handicap Integrity" section at the bottom — table of player × round with flag, net delta, and odds

**Note:** The `HandicapAdjustment` audit model (for when admin manually corrects a handicap based on this analysis) is created in **Workstream B (B-1)**. The sandbagger display works without it — add the "Adjust Handicap" button in the Handicap Integrity section as a stub that calls the B-5 break glass endpoint when it lands.

**Files touched:** `lib/sandbagger.ts` (new), `lib/trip-view-data.ts`, `app/t/[tripSlug]/admin/admin-control-room.tsx`

---

### A-6. Leaderboard Enhancements
> **Depends on A-1 (format modules for layout switching).**

Today's team board shows only the current round's match cards.

**What to build:**

1. **Cumulative standings** — total points across all finalized rounds at the top of the team board. Add `cumulativePoints: Record<teamId, number>` to `getTeamBoardData()` return value. Sum `MatchSide.points` across all `FINAL` rounds.

2. **Stroke play leaderboard** — for `STROKE_BLIND` and `STABLEFORD` rounds, the match-card layout doesn't fit. `format.buildLeaderboardRows()` returns a `LeaderboardRow[]` sorted by net score. `team-board.tsx` checks `format.isMatchPlay` to choose which layout to render.

3. **Individual stats breakdown** — per-player gross total, net total, points contributed, sandbagger flag (from A-5). Add as a collapsible table in the lobby or a tab on the team board. Assemble in `getLobbyData()`.

4. **Historical round display** — completed rounds already show in the tab UI; extend `getTeamBoardData()` to accept an optional `roundId` filter. When a round is `FINAL`, return frozen data instead of recomputing live.

**Files touched:** `lib/trip-view-data.ts`, `app/t/[tripSlug]/team/team-board.tsx`, `app/t/[tripSlug]/lobby/lobby-view.tsx`

---

## Workstream B — ChatGPT Codex

### B-1. Schema Additions
> **Do this first. B-4, B-5, B-6 depend on it.**

All additions — no field removals, no renames. After applying: `npm run db:push` (dev) or `npm run db:migrate` (prod), then `npm run db:generate`.

```prisma
model PlayerRoundTee {
  id       Int    @id @default(autoincrement())
  playerId Int
  roundId  Int
  teeName  String
  player   Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
  round    Round  @relation(fields: [roundId], references: [id], onDelete: Cascade)
  @@unique([playerId, roundId])
}

model AdminAction {
  id      Int      @id @default(autoincrement())
  tripId  Int
  adminId Int?                          // null if action taken by system/owner without identity
  action  String                        // e.g. "override-score", "void-match", "adjust-handicap"
  payload Json                          // structured context (playerId, holeNumber, oldValue, etc.)
  at      DateTime @default(now())
  trip    Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
}

model HandicapAdjustment {
  id        Int      @id @default(autoincrement())
  playerId  Int
  tripId    Int
  oldValue  Float
  newValue  Float
  reason    String
  at        DateTime @default(now())
  player    Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)
  trip      Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
}

model NotificationEvent {
  id        Int      @id @default(autoincrement())
  tripId    Int
  type      String                      // e.g. "ROUND_STARTED", "ROUND_FINAL", "MATCH_STATUS"
  payload   Json
  createdAt DateTime @default(now())
  trip      Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  @@index([tripId, createdAt])          // for cursor-based polling
}

// Add to existing Match model:
// voidedAt   DateTime?
// voidReason String?

// Add to existing HoleScore model:
// @@index([roundId, playerId])
```

Also add the corresponding `PlayerRoundTee[]`, `AdminAction[]`, `HandicapAdjustment[]`, `NotificationEvent[]` back-relations to `Player`, `Trip`, `Round` as appropriate.

**Files touched:** `prisma/schema.prisma`

---

### B-2. AdminIdentity Role Enforcement
> **Independent of B-1. Can run in parallel.**

`AdminIdentity.role` (OWNER / ADMIN / PLAYER) exists in the DB but is never checked.

**What to build:**
- `lib/tenant-data.ts`: add `getAdminRole(slug): Promise<AdminRole | null>` — reads `AdminIdentity.role` for the current admin cookie
- `lib/tenant-data.ts`: add `requireRole(slug, minimum: AdminRole): Promise<void>` — throws a typed error if the caller's role is below the minimum
- Apply in `api/admin/ops/route.ts`:
  - `generate-teams`, `generate-matches`, `start-round`: require ADMIN
  - `finalize-round`: require ADMIN
  - `reset-round`, `void-match`, `override-score`, `emergency-wipe`: require OWNER
  - `team-assignment`, `team`, `match-side`: require ADMIN
- Return `403 { error: 'Requires OWNER access' }` on violation

**Files touched:** `lib/tenant-data.ts`, `app/t/[tripSlug]/api/admin/ops/route.ts`

---

### B-3. RoundSubmission Wiring
> **Independent of B-1. Can run in parallel.**

`RoundSubmission` records exist in the schema but `submittedAt` is never written. `getPlayerCardData()` hardcodes `submittedAt: null`.

**What to build:**
- `api/score/route.ts`: after saving a hole score, count how many distinct holes the player has scored in this round. If `count === course.holes.length` (typically 18), upsert a `RoundSubmission` with `submittedAt = new Date()`.
- `lib/trip-view-data.ts`: in `getPlayerCardData()`, query the real `RoundSubmission` row instead of hardcoding null.
- `admin-control-room.tsx`: show a "✓ submitted" badge next to each player's name in the round section.

**Files touched:** `app/t/[tripSlug]/api/score/route.ts`, `lib/trip-view-data.ts`, `app/t/[tripSlug]/admin/admin-control-room.tsx`

---

### B-4. Per-Player Tee Selection
> **Requires B-1 (PlayerRoundTee model).**

Today every player on a round uses the same `Course.teeName`. Rating and slope differ by tee, which changes course handicap.

**What to build:**
- `api/admin/ops/route.ts`: add PATCH action `player-tee` — sets `PlayerRoundTee` for a given player + round
- `lib/scoring.ts`: `getPlayerHandicap()` accepts optional `teeName` override. If provided, look up rating/slope for that tee name on the course. Falls back to `Course.teeName` if no override exists.
- `lib/trip-view-data.ts`: when assembling player card data, look up `PlayerRoundTee` for the player + round and pass tee override into `getPlayerHandicap()`
- `admin-control-room.tsx`: per-player tee selector dropdown in the round section (only shown when course has multiple tees entered)
- `app/t/[tripSlug]/join/`: optional tee preference field at registration (writes a `PlayerRoundTee` for each round at join time)

**Note on course tee data:** `Course` currently has a single `teeName`, `rating`, and `slope`. To support multiple tees per course, add a `CourseTee` model (or a `teeOptions: Json` field on `Course`) to store name/rating/slope per tee. The simpler path is `teeOptions: Json` — no additional relations needed.

**Files touched:** `prisma/schema.prisma` (CourseTee or teeOptions), `lib/scoring.ts`, `lib/trip-view-data.ts`, `app/t/[tripSlug]/api/admin/ops/route.ts`, `app/t/[tripSlug]/admin/admin-control-room.tsx`, `app/t/[tripSlug]/join/page.tsx`

---

### B-5. Admin Break Glass Tools
> **Port from `golf-trip-app/app/api/admin/blind-void/`, `admin/score/`. Requires B-1.**

Real trips hit edge cases: no-shows, wrong scores entered, a player can't finish a round.

**What to build — new POST actions in `api/admin/ops/route.ts`:**

1. **`void-match`** — set `Match.voidedAt = now()`, `Match.voidReason = payload.reason`. Optionally reassign `MatchPlayer` rows to a replacement match. Log `AdminAction`.

2. **`override-score`** — upsert a `HoleScore` for `{ playerId, roundId, holeNumber }` to `payload.gross`. Set a `HoleScore.overriddenByAdminAt` timestamp (add this nullable field in B-1). Log `AdminAction` with `{ playerId, holeNumber, oldGross, newGross, reason }`.

3. **`force-finalize`** — for each player in the round who has fewer than 18 hole scores, insert `HoleScore` rows for missing holes using the round's `scoreMax` value as gross (double bogey, triple bogey, etc.). Then set `Round.status = FINAL`. Log `AdminAction`.

4. **`emergency-wipe`** — delete all `HoleScore` rows for the trip (all rounds). Reset all `Round.status` to `NOT_STARTED`. Does NOT touch players, teams, or matches. Requires OWNER role (see B-2). Log `AdminAction`.

5. **`adjust-handicap`** — update `Player.handicap` to `payload.newValue`. Create a `HandicapAdjustment` record. Log `AdminAction`. All in one `db.$transaction()`.

**Admin UI additions** in `admin-control-room.tsx` — new "Break Glass" section at the bottom:
- Per-match void button with reason input
- Per-player per-hole score override form
- Force-finalize button per round
- Emergency wipe button (confirmation modal, OWNER only)
- Per-player handicap override form

**All writes must be atomic** — use `db.$transaction([...])` for each operation. The `AdminAction` record and the data change go together or not at all.

**Files touched:** `app/t/[tripSlug]/api/admin/ops/route.ts`, `app/t/[tripSlug]/admin/admin-control-room.tsx`, `lib/trip-ops.ts` (force-finalize logic), `prisma/schema.prisma` (add `overriddenByAdminAt` to HoleScore)

---

### B-6. Live Notifications
> **Port from `golf-trip-app/lib/notifications.ts`. Requires B-1.**

Today the team board polls every 4 seconds. golf-trip-app pushes named events to a `NotificationEvent` table.

**What to build:**
- Emit `NotificationEvent` rows from three places:
  - `api/admin/ops/route.ts`: on `start-round` (type: `ROUND_STARTED`) and `finalize-round` (type: `ROUND_FINAL`)
  - `api/score/route.ts`: when a match flips status (one side goes up/down) — type: `MATCH_STATUS`, payload includes match ID and new status string
- New `app/t/[tripSlug]/api/events/route.ts` — GET endpoint, accepts `?since=<ISO timestamp>`. Returns `NotificationEvent[]` created after that cursor for the trip. Client polls this every 5 seconds instead of re-fetching the full team board.
- Client component: lightweight toast/banner in `team-board.tsx` and `player-scorecard.tsx` that shows the latest event for ~4 seconds. Use the existing 4-second polling interval — replace the full re-render with an events check first, then re-render only if new events exist.

**Files touched:** `app/t/[tripSlug]/api/events/route.ts` (new), `app/t/[tripSlug]/api/score/route.ts`, `app/t/[tripSlug]/api/admin/ops/route.ts`, `app/t/[tripSlug]/team/team-board.tsx`, `app/t/[tripSlug]/player/player-scorecard.tsx`

---

## Track 3: Data Model Additions Summary

> Owned by **Workstream B**. All additions — no removals.

Complete schema block for reference (apply all at once in B-1):

```prisma
model PlayerRoundTee {
  id       Int    @id @default(autoincrement())
  playerId Int
  roundId  Int
  teeName  String
  player   Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
  round    Round  @relation(fields: [roundId], references: [id], onDelete: Cascade)
  @@unique([playerId, roundId])
}

model AdminAction {
  id      Int      @id @default(autoincrement())
  tripId  Int
  adminId Int?
  action  String
  payload Json
  at      DateTime @default(now())
  trip    Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
}

model HandicapAdjustment {
  id        Int      @id @default(autoincrement())
  playerId  Int
  tripId    Int
  oldValue  Float
  newValue  Float
  reason    String
  at        DateTime @default(now())
  player    Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)
  trip      Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
}

model NotificationEvent {
  id        Int      @id @default(autoincrement())
  tripId    Int
  type      String
  payload   Json
  createdAt DateTime @default(now())
  trip      Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  @@index([tripId, createdAt])
}

// Additions to existing Match model:
// voidedAt           DateTime?
// voidReason         String?

// Addition to existing HoleScore model:
// overriddenByAdminAt DateTime?

// New index on HoleScore:
// @@index([roundId, playerId])
```

---

## What to Leave Alone

- **Slug-based multi-tenancy** — solid, no changes needed
- **Admin configurator flow** — extend (add tee options, per-round allowance override), don't replace
- **Cookie auth model** — add role enforcement on top, don't swap the mechanism
- **BlueGolf + GolfCourseAPI course search** — working, no changes needed
- **Trip templates in `trip-data.ts`** — move format metadata to format modules; keep the template shell structure

---

## Parallel Build Sequences

```
Workstream A (Claude)          Workstream B (Codex)
─────────────────────          ────────────────────
A-1: Format modules            B-1: Schema additions
A-2: Pairing strategies        B-2: Role enforcement  ←── independent of B-1
A-4: Handicap allowance        B-3: RoundSubmission wiring  ←── independent of B-1
       ↓                              ↓ (after B-1 lands)
A-3: Smart pairing             B-4: Per-player tee selection
       ↓                       B-5: Break glass tools
A-5: Sandbagger                B-6: Live notifications
       ↓
A-6: Leaderboard enhancements

── Merge coordination ──────────────────────────────────────
After both workstreams complete: integrate A-5 sandbagger flag
into B-5 break glass "adjust-handicap" form.
Integrate A-6 individual stats with B-4 tee selection display.
```

The `RYDER_CUP_WEEKEND` template (3 rounds: STROKE_BLIND → FOUR_BALL → SINGLES) is the golden path to test against after each step.
