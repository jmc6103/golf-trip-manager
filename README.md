# Golf Trip Manager

Workspace for turning the current single-trip app into a private-link multi-trip platform.

This folder is intentionally separate from the production trip app while the multi-trip experience is built out.

## Routes

- `/` - trip creation / product entry point
- `/t/[tripSlug]` - public trip home
- `/t/[tripSlug]/join` - player invite link
- `/t/[tripSlug]/player` - player scoring shell
- `/t/[tripSlug]/team` - live team board shell
- `/t/[tripSlug]/admin` - admin control room shell
- `/t/[tripSlug]/format` - trip format guide

## Local Development

This app reuses the parent repo dependencies so it can run without installing a second `node_modules` folder.

```powershell
cd C:\Users\Joe\golf-trip-manager
npm install
npm run dev -- -p 3001
```

Open:

```text
http://localhost:3001
http://localhost:3001/t/richmond-open-2026
```

## Architecture Direction

The full version should add `tripId` or `tripSlug` scope to every core entity:

- Trip
- Membership / role
- Player
- Course
- Round
- Match
- HoleScore
- RoundSubmission
- Ruleset

The key product idea is link-first access:

- Admin creates a trip and gets an owner/admin link.
- Players join through a trip invite URL.
- All scoring, formats, and rules live under the trip URL.
