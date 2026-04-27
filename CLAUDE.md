# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Next.js with Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run db:push      # Push schema changes to DB without migration (dev)
npm run db:migrate   # Run pending migrations (production)
npm run db:generate  # Regenerate Prisma client after schema changes
```

No test suite is configured.

Set `DATABASE_URL` (PostgreSQL connection string) in `.env.local`. The app degrades gracefully without it — pages render with static/empty data rather than erroring.

## Architecture

### Route structure

All trip-specific routes live under `/t/[tripSlug]/` and are isolated per trip (multi-tenant by slug):

| Route | Purpose |
|---|---|
| `/` | Trip listing + create-trip flow |
| `/t/[tripSlug]/admin` | Setup (configurator) + live control room |
| `/t/[tripSlug]/join` | Player registration |
| `/t/[tripSlug]/lobby` | Roster, teams, round navigation |
| `/t/[tripSlug]/player` | Personal scorecard (client-fetched) |
| `/t/[tripSlug]/team` | Live team/match scoreboard |
| `/t/[tripSlug]/format` | Format rules guide |

### API routes

Trip-scoped API handlers live under `/t/[tripSlug]/api/` (not the top-level `/api/`):

- `api/score` — POST a hole score (player-authed via cookie)
- `api/player-card` — GET full player card data
- `api/lobby` — GET lobby/roster data
- `api/team-view` — GET team board + match summaries
- `api/admin/ops` — POST (generate-teams, generate-matches, start-round, finalize-round, reset-round) / PATCH (team-assignment, team rename, match-side players)

Global API:
- `/api/courses/search` — course search
- `/api/courses/bluegolf` — BlueGolf course scraper

### lib/ layer

| File | Responsibility |
|---|---|
| `db.ts` | Singleton Prisma client (singleton pattern for Next.js dev HMR) |
| `types.ts` | Shared TypeScript types (no Prisma imports — use plain unions) |
| `trip-data.ts` | Static data only: format options, templates, `TripSetupDraft` helpers. Safe to import in any context. |
| `tenant-data.ts` | DB-backed trip CRUD, cookie auth, `upsertTripFromSetup`. All functions guard on `DATABASE_URL`. |
| `trip-ops.ts` | Mutation logic: team generation (balanced/random), match generation, round start/finalize. |
| `trip-view-data.ts` | Read-heavy view assemblers: `getLobbyData`, `getTeamBoardData`, `getPlayerCardData`. Calls `ensureCourseHoles` as a side-effect. |
| `scoring.ts` | Pure functions: net scores, stroke distribution, match hole-by-hole status, match result label. No DB access. |

### Auth model

No auth library. Two cookie-based access levels, both scoped to `/t/[tripSlug]`:

- **Admin**: SHA-256 hash of admin token stored in `Trip.adminTokenHash`. Cookie name: `gtm_admin_{slug}`. Set on first create; verified via `hasAdminAccess(slug, queryToken?)` which checks cookie or `?adminToken=` query param.
- **Player**: Random base64url access token stored in `Player.accessToken`. Cookie name: `gtm_player_{slug}`. Set on join. Retrieved via `getPlayerFromCookie(slug)`.

### Trip lifecycle

`DRAFT → REGISTRATION → TEAMS_READY → LIVE → COMPLETE → ARCHIVED`

- Admin ops route drives transitions: generate-teams sets `TEAMS_READY`, start-round sets `LIVE`.
- `upsertTripFromSetup` always sets status to `REGISTRATION` (idempotent re-setup).

### Data model key points

- `Trip` → `Round` → `Match` → `MatchSide` → `MatchPlayer` chain drives all match play.
- `HoleScore` is written per-player per-hole and linked to both `Round` and `Match` (nullable).
- `Course` → `Hole` provides par/strokeIndex for handicap calculation. Default 18-hole layout created by `buildDefaultHoles()` if no holes exist.
- Handicap strokes computed live in `scoring.ts` using `strokeIndex`; never stored on `HoleScore`.
- `STROKE_BLIND` and `STABLEFORD` rounds skip match generation in `generateMatchesForTrip`.
- Team scoring formats (`SCRAMBLE`, `SHAMBLE`, `STABLEFORD`) create multiple teams; two-team formats create `Blue`/`Red` teams.
