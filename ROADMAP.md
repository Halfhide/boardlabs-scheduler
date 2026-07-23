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
| 1 | Creator controls     | 1     | done        |
| 2 | Voting deadline      | 1     | done        |
| 3 | Finalize a date      | 1     | done        |
| 4 | Availability heatmap | 2     | done        |
| 5 | Doodle-style matrix  | 2     | done        |
| 6 | My polls list        | 2     | done        |
| 7 | Player capacity      | 3     | done        |
| 8 | Game voting          | 3     | done        |
| 12 | BGG game search     | 3     | done        |
| 9 | Polish + i18n        | 4     | done        |
| 10 | PWA install         | 4     | done        |
| 11 | Google sign-in      | 5     | not started |

## Phase 1: Poll lifecycle (foundations)

Order matters here: creator identity (feature 1) is the foundation for
features 2 and 3, and is designed to be migratable to real auth in
phase 5.

### 1. Creator controls

Status: done (15 Jul 2026, commit e071ec0). Implemented with `creatorToken` on the
poll document plus `closed` flag, AdminBar component (rename, add
date, close/reopen), two-step date removal in the date modal, and
extended Firestore rules. Identity is enforced client-side as
planned; the updated rules validate shape and immutability only.
Note for later features: `closed` gating exists and feature 2 can
reuse it. The updated `firebase-rules.txt` must be applied manually
before creator actions work against hardened rules.

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

Status: done (15 Jul 2026, commit 40f2753). Optional `deadline` timestamp on the poll
document; datetime-local field on the create form; countdown banner
while open; auto-flip to the closed state via a 30-second useNow tick;
creator can set, change or remove the deadline from the AdminBar, and
reopening a manually closed poll clears a passed deadline so reopening
actually reopens. Enforcement is client-side as planned. Rules updated
for the new optional field (manual deploy needed).
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

Status: done (15 Jul 2026). Optional `finalizedDateId` on the poll
document. The creator finalizes (or un-finalizes) from the date modal;
the AdminBar shows the finalized status with an un-finalize button and
hides the close-voting toggle while finalized. Everyone sees a green
"We're playing on ..." banner with yes/maybe attendee lists; the
chosen date gets a distinct calendar style plus legend entry and a
CHOSEN badge in results (replacing BEST). Finalizing closes voting via
the shared isClosed logic; removing the chosen date is blocked until
un-finalized. Rules updated for the new optional field. Phase 1 is
complete. (Commit 4f09571; a follow-up, 6512c96, replaced all confetti
with 3D CSS dice bursts and removed the canvas-confetti dependency.)
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

Status: done (15 Jul 2026). "My votes" / "Group availability" toggle
on the calendar (local state in Calendar.jsx). Group mode shades poll
dates across five green buckets by score (yes 1, maybe 0.5) relative
to the poll's unique voter count, shows the yes-count inside each
cell, uses red for "votes exist but nobody can attend" and the
available style for unvoted dates; the legend swaps per mode and the
finalized-date style wins in both modes. Live updates preserve the
selected mode.

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

Status: done (15 Jul 2026). New VoteMatrix component between the
calendar and results: rows are participants (current user pinned
first and highlighted), columns are dates with clickable headers
that open the date modal, colored vote marks, a "Can attend" totals
row, sticky name column, chosen-date highlight, and horizontal
scrolling contained inside the card (verified: page overflow-x stays
false at 390px and with a 46-date poll). Hidden until the poll has
at least one voter.

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

Status: done (15 Jul 2026). localStorage-backed list (utils/myPolls.js,
key `myPolls`, capped at 50 entries): entries are recorded on poll
creation and refreshed on every poll visit (title stays current after
renames, the created-by-me flag is sticky). The homepage shows a
"Your polls" card under the create form with links, "YOURS" badges,
last-opened times and per-entry removal. All storage access is
try/catch guarded. Phase 2 is complete.

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

Status: done (15 Jul 2026). Optional `minPlayers`/`maxPlayers` on the
poll document (create form and AdminBar, validated 1-99 with max >=
min, clearable). getCapacityStatus derives "Needs N more players" /
"Enough players" / "Full" from yes counts; badges show on results
cards and in the date modal header, updating live. getBestDates ranks
viable dates (yes >= min) first. Rules updated for the new optional
int fields (manual deploy needed). Polls without capacity behave
exactly as before.
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

Status: done (15 Jul 2026). Optional `games` array on the poll
document (capped at 30, validated in rules; manual deploy needed).
New GameVoting section ("What shall we play?") between the matrix
and results: named participants suggest games (title up to 80 chars,
optional http(s) link) and toggle one vote per game by voter ID; the
suggester auto-votes their own suggestion; duplicates are rejected
case-insensitively. The list sorts by votes with a LEADING badge,
shows voter names, and the creator can remove suggestions (two-step
confirm). Game actions lock when the poll is closed. The finalize
banner shows the leading game with its vote count. The leading game
lives in the GameVoting card and finalize banner rather than on each
results card (kept the cards compact). Legacy polls without a games
field work unchanged.
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

### 12. BoardGameGeek game search (added 15 Jul 2026 on Adam's request)

Status: done (16 Jul 2026, commit f5d413a; completed 23 Jul 2026
after BGG approved Adam's application: token configured, live API
verified in the browser, official "Powered by BGG" logo added to the
game voting card linking back to boardgamegeek.com as their terms
require). Implemented end to end:
`api/bgg-search.js` (the repo's first serverless function) proxies BGG
XML API2 search and returns trimmed JSON; the same handler is mounted
on the Vite dev server by vite.config.js, so `npm run dev` serves it
too. GameSearchInput adds debounced (300ms, min 2 chars) autocomplete
to the game suggestion form: keyboard and mouse selection fill title
plus BGG link, Escape dismisses, plain Enter still submits free text,
and any BGG failure fails silent. Editing the title after picking a
suggestion clears the auto-filled link so it cannot point at the
wrong game.
IMPORTANT: since July 2025 BGG requires a registered application and
a Bearer token (the roadmap's "needs no API key" assumption is
outdated, see https://boardgamegeek.com/using_the_xml_api). Until
Adam registers at https://boardgamegeek.com/applications (approval
can take a week or more) and sets BGG_API_TOKEN in Vercel env and in
.env locally, BGG answers 401 and the UI falls back to plain
free-text entry, which was verified to work. The dropdown UI was
verified in the browser against a temporary canned-data mock; the
proxy's parsing, ranking, 202-retry and error paths were verified
with mocked BGG responses. Live BGG responses remain unverified
until a token exists. Public-facing apps must also show the
"Powered by BGG" logo per their terms; revisit once the token works.

Depends on: game voting (feature 8, done).

Goal: when suggesting a game, typing its name shows live suggestions
from the BoardGameGeek database; picking one fills the title and the
BGG link automatically.

Scope:
- Autocomplete on the GameVoting title input: debounce keystrokes
  (~300ms, min 2-3 chars), query BGG, show a dropdown of matches
  (name + year to disambiguate editions), keyboard and click
  selection, and a way to dismiss and keep free text (typing a game
  BGG does not know must keep working).
- On selection, fill the title and set the link to
  https://boardgamegeek.com/boardgame/<id>.
- BGG XML API2 (https://boardgamegeek.com/xmlapi2/search?query=...&
  type=boardgame) needs no API key BUT sends no CORS headers, so the
  browser cannot call it directly. Add a Vercel serverless function
  (api/bgg-search.js) that proxies the query, parses the XML and
  returns trimmed JSON ({id, name, year}[]). This is the repo's
  first backend code; note that `npm run dev` alone will not serve
  it (use `vercel dev`, or a small Vite dev proxy fallback).
- Be polite to BGG: cancel stale requests, cap results (~10), and
  handle their 202 "try again" responses and rate limiting
  gracefully (fail silent to free-text entry, never block the form).
- Optional nice-to-have if cheap: fetch min/max players for the
  selected game (xmlapi2/thing) and hint the creator about the
  capacity setting (feature 7).

Acceptance criteria:
- Typing shows relevant BGG suggestions; selecting one fills title
  and link; free-text suggestions still work when BGG is down or has
  no match; the deployed app works on Vercel (proxy function included
  in the deployment).

## Phase 4: Reach

### 9. Polish + i18n

Status: done (16 Jul 2026, commit b153d1f). Dependency-free i18n in
src/i18n/:
translations.js (all UI strings for en and pl, {param} interpolation,
plural forms with proper Polish rules), LanguageProvider + context +
useTranslation hook exposing t(), lang, setLang and the matching
date-fns locale. EN/PL toggle in the header; persisted under the
localStorage key `language`; default from navigator.language. All
date formatting goes through date-fns with the active locale, format
patterns live in the dictionary (Polish gets "d MMMM yyyy" style and
24h times), and the calendar starts weeks per locale (Monday in
Polish, Sunday in English) with translated weekday letters. Errors
thrown by pollHelpers now carry a `code` translation key (message
stays English for the console) and translateError() renders them;
getCapacityStatus returns {key, needed} instead of an English label;
usePoll returns error keys. Verified in the browser in both
languages: create form, poll page, calendar (week start + month
names), matrix, game voting, results, date modal, voting flow,
AdminBar, capacity plurals, relative times, toggle persistence
across reload.

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

Status: done (16 Jul 2026, commit b472f70). vite-plugin-pwa
(generateSW, autoUpdate)
with a full manifest: name, standalone display, theme color #2563eb,
and generated dice icons (192/512 any + 512 maskable + 180 Apple
touch icon; produced by a dependency-free Node PNG script, blue die
with white pips). The precached app shell is served for all
navigations (navigateFallback to index.html, /api/ excluded so BGG
search fails cleanly), poll data stays live from Firestore. A
translated OfflineBanner (navigator.onLine + online/offline events)
shows a clear notice when the connection drops. Verified against the
production build (vite preview): SW activated, manifest correct,
shell + deep poll links load with the server killed, banner appears
and clears in both languages, live data still flows through the SW.
Installability criteria checked programmatically (SW + valid
manifest with required icons); a full Lighthouse run was not
performed. Housekeeping in the same change: `npm audit fix` cleared
all 11 reported vulnerabilities (firebase 12.11, react-router-dom
7.18.1, vite 7.3.6; semver-compatible bumps only).

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
- 15 Jul 2026: feature 1 (creator controls) implemented and verified
  in the browser; firebase-rules.txt updated (manual deploy needed).
- 15 Jul 2026: feature 2 (voting deadline) implemented and verified
  in the browser, including watching a live deadline pass and the
  poll close itself; firebase-rules.txt updated again.
- 15 Jul 2026: feature 3 (finalize a date) implemented and verified
  in the browser; phase 1 complete. firebase-rules.txt updated again
  (one manual deploy covers all of phase 1).
- 15 Jul 2026: all confetti replaced with 3D CSS dice bursts on
  Adam's request; canvas-confetti dependency removed (commit 6512c96).
- 15 Jul 2026: feature 4 (availability heatmap) implemented and
  verified in the browser. No data model or rules changes.
- 15 Jul 2026: feature 5 (Doodle-style matrix) implemented and
  verified in the browser, including a 46-date poll and a 390px
  viewport. No data model or rules changes.
- 15 Jul 2026: feature 6 (my polls list) implemented and verified in
  the browser; phase 2 complete. No data model or rules changes.
- 15 Jul 2026: feature 7 (player capacity) implemented and verified
  in the browser (all three states plus viable-first ranking);
  firebase-rules.txt updated again.
- 15 Jul 2026: feature 8 (game voting) implemented and verified in
  the browser with two voters; phase 3 complete. firebase-rules.txt
  updated again (one manual deploy covers everything to date).
- 15 Jul 2026: Adam requested a Game Voting extension: live game
  name autocomplete from the BoardGameGeek API. Added as feature 12
  in phase 3 (next in line before phase 4).
- 16 Jul 2026: feature 12 (BGG game search) implemented: serverless
  proxy plus autocomplete UI, verified in the browser (dropdown flows
  against canned data, silent free-text fallback against the real
  401). Discovered BGG now requires app registration and a Bearer
  token; Adam must register and set BGG_API_TOKEN before live
  suggestions work. No Firestore rules changes.
- 16 Jul 2026: feature 9 (Polish + i18n) implemented and verified in
  the browser in both languages, including locale-aware calendars
  (Monday-first Polish weeks), Polish plural forms, translated error
  paths, and a persisted EN/PL header toggle. No data model or rules
  changes.
- 16 Jul 2026: feature 10 (PWA install) implemented and verified
  against the production build: installable manifest with generated
  dice icons, service worker app shell (works with the server down,
  deep links included), translated offline notice. Phase 4 complete.
  npm audit fix applied alongside (0 vulnerabilities left). No data
  model or rules changes.
- 23 Jul 2026: BGG approved the API application. BGG_API_TOKEN set
  locally and in Vercel; live autocomplete verified in the browser
  (real search results, exact-match ranking, selection fills the
  real BGG link). Official "Powered by BGG" logo bundled and shown
  in the game voting card. Feature 12 fully closed.
