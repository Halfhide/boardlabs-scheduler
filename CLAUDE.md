# Board Game Scheduler: project memory

Read this first. It is the entry point for any Claude Code session
working in this repo.

## What this is

A Doodle-style date poll app for scheduling board game nights. React 19
plus Vite, Tailwind CSS 4, Firebase Firestore (real time, no auth),
deployed on Vercel from `main` (repo: Halfhide/boardlabs-scheduler).
No accounts: voters enter a name; identity is a random `voterId` kept
in localStorage. Full description and data model are in `README.md`.

## Development plan

**`ROADMAP.md` is the agreed development plan. Before starting feature
work, read it and follow its instructions**: work through phases in
order, pick the next `not started` feature unless Adam says otherwise,
and update the feature's status as you go. Do not build the features
listed there as rejected.

## Commands

- `npm run dev` for the dev server, `npm run lint`, `npm run build`,
  `npm test` (vitest unit suite for the pure logic in src/utils).
- The unit tests cover pure logic only. Verify features by driving
  the app in the browser (dev server + real interaction), not just
  lint/test/build.

## Hard constraints and gotchas

- **Never use em-dashes or en-dashes** in any output, chat or files
  (workspace-wide rule from Adam).
- All Firestore writes that modify the shared `dates` array must run
  inside `runTransaction` (see `src/utils/pollHelpers.js`). Plain
  read-modify-write loses concurrent votes.
- Vote identity: match votes with `isVoteByVoter`/`findUserVote`
  (voter ID with fallback to name for legacy votes). Never match by
  name alone.
- Tailwind is v4: `bg-black/50`, not `bg-opacity-50`. Removed v3
  utilities fail silently.
- Date handling: poll dates are `YYYY-MM-DD` strings. Use date-fns
  for all date math (manual `setDate` arithmetic broke on DST
  transitions before).
- Firestore rules live in `firebase-rules.txt` but are applied
  MANUALLY by Adam in the Firebase console. If you change them, say
  so explicitly and loudly in your summary.
- Polls can only be deleted by their signed-in owner (rules enforce
  uid == ownerUid; anonymous or unclaimed polls are undeletable).
  Avoid creating test polls in the real database unless needed for
  verification; if you create one, label it clearly ("Test poll ...
  safe to ignore"), tell Adam, and delete it when done if you can.
  One legacy unclaimed test poll exists: `RjwDCzmNa8`.
- `.env` holds the Firebase web config (gitignored). Do not print its
  values into chat, commits, or files.
- BGG autocomplete (`api/bgg-search.js`, proxied into the dev server
  by vite.config.js) needs `BGG_API_TOKEN` (in `.env` locally, Vercel
  env in prod). BGG requires a registered application since Jul 2025;
  without the token BGG answers 401 and the UI silently falls back to
  free-text entry.

## Working conventions

- CI/CD loop (established 1 Sep 2026): all changes ship through
  feature branches and pull requests. `main` is protected: PR
  required, the `ci` check must be green, the branch up to date,
  admins included, so direct pushes are rejected. GitHub Actions
  runs lint, tests, build and a landing/pl staleness check on every
  PR. Squash merge is the house style; merged branches auto-delete;
  merging to `main` deploys production on Vercel. Once a change is
  ready and verified, branching, committing and opening the PR is
  normal session work; Adam reviews and merges (or explicitly asks
  for a merge from the session).
- Vercel preview deployments reach Firestore under App Check
  through a fixed debug token: `VITE_APP_CHECK_DEBUG_TOKEN`, a
  Preview-scoped Vercel env var registered in Firebase App Check's
  debug token list, with previews behind Vercel Authentication.
  NEVER add that variable to the Production scope.
- The repo is public (GPL-3) since 1 Sep 2026. Never commit
  anything secret; `.env` stays gitignored.
- Keep the existing code style: plain JSX, function components, small
  focused components, Tailwind utility classes inline.
- lint must stay clean; the eslint config forbids synchronous setState
  inside effects (use render-phase state adjustment for prop-change
  resets, see `src/hooks/usePoll.js`).
