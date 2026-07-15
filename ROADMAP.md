# Development Roadmap

This is the agreed development plan for Board Game Scheduler. It was
distilled from a feature review with Adam on 15 Jul 2026: 15 candidate
features were proposed, 11 accepted, 4 rejected (see bottom).

## How to use this file (instructions for Claude Code sessions)

- Read this file before starting any feature work in this repo.
- Work through phases in order. Within a phase, pick the next feature
  whose status is `not started`, unless Adam asks for something specific.
- Update the feature's status line when you start (`in progress`) and
  when you finish (`done`, with the date and commit hash).
- A feature is done when: it works end to end (verify in the browser,
  not just lint/build), `npm run lint` and `npm run build` pass, and
  the acceptance criteria below are met.
- If a feature requires Firestore rules changes, update
  `firebase-rules.txt` and tell Adam to apply it manually in the
  Firebase console. Rules are NOT deployed automatically.
- Keep the constraints in CLAUDE.md (transactions for writes, voter ID
  identity, Tailwind v4 syntax, no em-dashes anywhere).
- Commit only when Adam asks. He usually asks after reviewing.

## Status overview

| # | Feature              | Phase | Status      |
|---|----------------------|-------|-------------|
| 1 | Creator controls     | 1     | not started |
| 2 | Voting deadline      | 1     | not started |
| 3 | Finalize a date      | 1     | not started |
| 4 | Availability heatmap | 2     | not started |
| 5 | Doodle-style matrix  | 2     | not started |
| 6 | My polls list        | 2     | not started |
| 7 | Player capacity      | 3     | not started |
| 8 | Game voting          | 3     | not started |
| 9 | Polish + i18n        | 4     | not started |
| 10 | PWA install         | 4     | not started |
| 11 | Google sign-in      | 5     | not started |

## Phase 1: Poll lifecycle (foundations)

Order matters here: creator identity (feature 1) is the foundation for
features 2 and 3, and is designed to be migratable to real auth in
phase 5.

### 1. Creator controls

Status: not started

Goal: polls have an owner who can manage them.

Scope:
- On poll creation, generate a random `creatorToken` (nanoid), store a
  hash or the token itself in the poll document, and keep the token in
  the creator's localStorage (keyed by poll ID, e.g.
  `creatorToken:<pollId>`).
- When the visitor holds the matching token, show an admin bar on the
  poll page: edit title, add a date, remove a date (only dates with no
  votes, or with a confirmation), close/reopen voting.
- All admin writes go through Firestore transactions like votes do.
- Firestore rules: title changes and dates array resizing are currently
  forbidden; relax them only for requests that carry the creator token
  in the document (rules can compare a `creatorToken` field passed in
  the update against the stored one; note this is obfuscation, not real
  security, acceptable for this app until phase 5).

Acceptance criteria:
- Creator sees admin controls on their poll; other visitors do not.
- Creator can rename the poll and add/remove dates; changes appear
  live for other viewers.
- A visitor without the token cannot perform admin actions (verify
  both in UI and by the rules rejecting a forged write).

### 2. Voting deadline

Status: not started
Depends on: creator controls (creation form fields, admin bar).

Goal: polls can close automatically at a chosen moment.

Scope:
- Optional deadline (date + time) field on the create form; stored on
  the poll document.
- Poll page shows a countdown or "voting closes on ..." notice.
- After the deadline, vote buttons are disabled client-side and the
  poll shows a "voting closed" state. Client-side enforcement is
  enough for v1 (rules cannot reliably compare against request time
  for array rewrites without heavy restructuring; note it in code).
- Creator can change or remove the deadline from the admin bar.

Acceptance criteria:
- A poll with a past deadline shows closed state and blocks voting.
- A poll without a deadline behaves exactly as today.

### 3. Finalize a date

Status: not started
Depends on: creator controls.

Goal: polls conclude with a decision everyone can see.

Scope:
- Creator picks a winning date (from admin bar or a button on a
  results card). Stored as `finalizedDateId` on the poll document.
- Poll page shows a prominent banner: "We are playing on Friday,
  March 27" with the attendee list (yes + maybe voters of that date).
- Calendar highlights the chosen date distinctly; voting is closed
  (same closed state as the deadline feature).
- Creator can un-finalize (reopen) the poll.

Acceptance criteria:
- Finalizing updates all open viewers live.
- The banner lists who is coming, using the voter breakdown.

## Phase 2: Group visibility

Independent features; any order. These build on the "see who you are
playing with" direction from the voter breakdown work.

### 4. Availability heatmap

Status: not started

Goal: see at a glance which dates work for the most people.

Scope:
- Toggle on the calendar: "my votes" (current behavior) vs "group".
- In group mode, poll dates are shaded by a score (yes = 1,
  maybe = 0.5, no = 0) relative to the number of voters; show the
  yes-count in the cell.
- Keep the existing legend, swap it appropriately per mode.

Acceptance criteria:
- Toggling modes never loses state; both modes update live.
- Empty polls render sensibly in group mode.

### 5. Doodle-style matrix

Status: not started

Goal: full-group availability table like Doodle.

Scope:
- New view (tab or section on the poll page): rows = participants,
  columns = dates, cells = colored vote marks; a totals row on top.
- Current user's row highlighted and pinned first.
- Horizontally scrollable on mobile (the page must not scroll
  sideways as a whole).
- Clicking a column header opens that date's modal.

Acceptance criteria:
- Renders correctly for 10+ voters and 30+ dates without layout
  breakage on mobile widths.

### 6. My polls list

Status: not started

Goal: people stop losing poll links.

Scope:
- Keep a list in localStorage: polls created (with creator flag) and
  polls visited, with title and last-seen timestamp.
- Homepage shows the list under the create form; entries link to the
  poll, show a small "yours" badge for created polls, and can be
  removed from the list.

Acceptance criteria:
- Visiting and creating polls populates the list; removal works;
  nothing breaks with an empty list or with localStorage disabled.

## Phase 3: Game night depth

### 7. Player capacity

Status: not started
Depends on: creator controls (settings live in the admin surface).

Goal: reflect that board games have player counts.

Scope:
- Creator sets optional min/max players on the poll (create form +
  admin bar).
- Date cards and results show state: "needs X more", "enough players",
  "full" (based on yes votes; maybe counts toward "possible").
- Results ranking prefers viable dates (yes-count >= min) before the
  existing sort.

Acceptance criteria:
- States update live as votes come in; polls without capacity set
  behave exactly as today.

### 8. Game voting

Status: not started
Depends on: creator controls recommended first (creator may want to
curate suggestions).

Goal: decide what to play, not only when.

Scope:
- Second section on the poll page: game suggestions. Any named
  participant can suggest a game (title, optional BoardGameGeek URL)
  and vote for game suggestions (one vote per game per voter, by
  voter ID).
- Stored on the poll document as a `games` array; writes in
  transactions; Firestore rules extended for the new field.
- Results show the leading game next to the winning date; finalize
  banner (feature 3) includes the chosen game if one exists.

Acceptance criteria:
- Suggesting, voting, and unvoting work live for multiple users;
  legacy polls without a games field keep working.

## Phase 4: Reach

### 9. Polish + i18n

Status: not started

Goal: full UI in Polish and English.

Scope:
- Lightweight i18n (a small dictionary module + context hook is fine;
  avoid heavy dependencies unless clearly better).
- Language toggle in the header; persisted in localStorage; default
  from browser language.
- Translate all UI strings including date formatting (date-fns has a
  `pl` locale).

Acceptance criteria:
- No hardcoded English strings left in components; dates render in
  the active locale; toggle persists across reloads.

### 10. PWA install

Status: not started

Goal: installable app that feels native on phones.

Scope:
- Web manifest (name, icons, theme color) and a service worker with
  an offline app shell (vite-plugin-pwa is the standard choice).
- Poll data is live from Firestore, so offline mode only needs a
  graceful "you are offline" state, not offline voting.

Acceptance criteria:
- Lighthouse recognizes the app as installable; installed app opens
  to the homepage; offline visit shows the shell with a clear
  offline notice.

## Phase 5: Accounts

### 11. Optional Google sign-in

Status: not started
Depends on: phases 1-3 stable. This is a big architectural step;
plan it in its own session with Adam before writing code.

Goal: stable identity across devices and real security.

Scope (outline, refine before implementation):
- Firebase Auth with Google provider; signing in is optional and
  merges with the anonymous voter ID (existing votes by the local
  voter ID get claimed by the account).
- Creator rights verified by auth UID instead of the creator token
  (migrate: token holders can attach their UID once).
- Firestore rules rewritten to validate vote ownership properly for
  signed-in users.
- Signed-out users keep working exactly as today.

Acceptance criteria: defined during its planning session.

## Rejected features (do not build unless Adam changes his mind)

- Time slots (time-of-day options): rejected 15 Jul 2026.
- Calendar export (.ics / Google Calendar): rejected 15 Jul 2026.
- Richer share options (QR, WhatsApp buttons, OG tags): rejected
  15 Jul 2026.
- Dark mode: rejected 15 Jul 2026.

## Changelog

- 15 Jul 2026: roadmap created from the feature review session.
