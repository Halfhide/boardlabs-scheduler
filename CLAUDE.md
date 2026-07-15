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

- `npm run dev` for the dev server, `npm run lint`, `npm run build`.
- There is no test suite. Verify changes by driving the app in the
  browser (dev server + real interaction), not just lint/build.

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
- Polls cannot be deleted by clients (rules forbid it). Avoid creating
  test polls in the real database unless needed for verification; if
  you create one, label it clearly ("Test poll ... safe to ignore")
  and tell Adam. One such poll already exists: `RjwDCzmNa8`.
- `.env` holds the Firebase web config (gitignored). Do not print its
  values into chat, commits, or files.

## Working conventions

- Commit or push only when Adam explicitly asks. He works directly on
  `main` (no PR flow) and Vercel auto-deploys from it.
- Keep the existing code style: plain JSX, function components, small
  focused components, Tailwind utility classes inline.
- lint must stay clean; the eslint config forbids synchronous setState
  inside effects (use render-phase state adjustment for prop-change
  resets, see `src/hooks/usePoll.js`).
