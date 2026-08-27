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
| 11a | Auth foundation    | 5     | done        |
| 11b | Identity merge     | 5     | done        |
| 11c | My polls sync      | 5     | done        |
| 11d | Poll deletion      | 5     | done        |
| 11e | Poll auto-expiry   | 5     | done        |
| 11f | Rules + App Check  | 5     | done        |
| 11g | Privacy note       | 5     | done        |
| 13 | Design system align | 6     | done        |
| 14 | Domain + landing    | 6     | done        |
| 15 | Donations           | 6     | done        |
| 17 | Bring a friend      | 6     | done        |
| 18 | Branded splash      | 6     | done        |
| 19 | SEO launch foundation | 6b  | done        |
| 20 | Bilingual landing URLs | 6b | not started |
| 21 | Performance pass    | 6b    | not started |
| 16 | Enriched my-polls   | 7     | not started |

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

## Phase 5: Accounts + public launch

Planned with Adam on 23 Jul 2026. Goal: the app is safe and complete
enough to share publicly. Decisions made: sign-in methods are Google
plus email magic link (no passwords, ever); sign-in stays fully
optional for everyone (voting and creating keep working signed out);
account features include cross-device "my polls", owner poll
deletion, and poll auto-expiry; the full hardening package ships in
the same phase (rules rewrite, Firebase App Check, privacy note in
PL and EN).

Known ceiling, accepted: because anonymous voting stays allowed,
Firestore rules can only enforce true per-vote ownership for
signed-in users. Anti-abuse for anonymous traffic rests on App
Check, shape validation, and size caps. Poll deletion requires
being signed in as the owner (a browser token is too weak to
authorize permanent deletion; anonymous creators sign in first and
ownership is claimed automatically).

Work through the sub-features in order; each follows the usual
rules (status updates, browser verification, lint/build green).

### 11a. Auth foundation

Status: done (26 Jul 2026, commit 7d575ad). Implemented: `auth`
exported from firebase.js, AuthProvider (src/auth/) with
onAuthStateChanged user state, Google popup sign-in, magic link
send/complete including the cross-device email re-prompt and URL
param cleanup, and an AccountMenu in the header (sign-in modal with
Google + email link, avatar menu with name/email and sign-out),
fully translated EN/PL. Signed-out app is byte-for-byte unchanged.
Verified end to end in the browser with Adam: Google popup sign-in
(avatar + account menu, session survives reload, sign-out works)
and a real magic-link sign-in from the email (same Firebase account
as the Google sign-in, auth state propagated across tabs). Error
paths verified too: disabled-provider errors show a friendly
banner, an invalid/spent link shows the link-invalid error, the
cross-device confirm-email modal auto-opens on a link URL and
dismissing it strips the link params.
Known quirk, accepted: Firebase sign-in emails land in spam (the
default noreply@<project>.firebaseapp.com sender). The link-sent
confirmation warns about this in bold in both languages; the real
deliverability fix is a post-launch follow-up (see note above the
phase acceptance criteria).
The Gmail MCP connector cannot see the spam folder, useful to know
when debugging this in future sessions.

Firebase Auth with Google and email-link providers. Header UI:
sign-in button, account menu with avatar/name and sign-out. Magic
link flow: enter email, click the link from the inbox, signed in
(handle the return URL and the cross-device email re-prompt). An
AuthContext exposes the current user app-wide. Signed-out behavior
is byte-for-byte today's app.
MANUAL (Adam, Firebase console): enable Google and Email link
(passwordless) sign-in providers; confirm the Vercel domain is in
Auth's authorized domains.

### 11b. Identity merge and ownership claim

Status: done (26 Jul 2026, commit f655689). Implemented: votes,
comments, game suggestions and game votes carry the signed-in
user's `uid` (kept alongside voterId/voterName; a signed-out
re-vote preserves a claimed uid). claimPollIdentity() runs on every
signed-in poll visit inside a transaction: it stamps the uid onto
this browser's anonymous activity and attaches ownerUid when the
browser holds the creator token and the poll is unowned; it writes
nothing when there is nothing to claim and never breaks the page.
Identity matching (isVoteByVoter/findUserVote) is uid-aware with
uid comparison decisive when both sides have one; participant
dedupe in the calendar and matrix keys by uid first so one person
on two devices counts once. Creator access and all creator actions
(runCreatorUpdate) authorize by ownerUid OR legacy token; polls
created signed-in get ownerUid at creation. Firestore rules updated
and applied by Adam: ownerUid allowed on create only as the
requester's own uid, set-once on update, immutable afterwards.
Verified in the browser end to end: anonymous vote claimed on
signed-in visit (other voters untouched), signed-in creation owns
immediately, REST-created anonymous poll claimed on visit, and with
the browser token deleted the creator tools still appear and a
rename persists (uid-only authorization through the new rules).
Test polls created for this: utY99RDlyn and 8BJoLEAHEA (both
labeled, safe to ignore, deletable once 11d ships).

Signed-in users act under their UID: new votes/comments/games carry
it. On visiting a poll while signed in, votes matching the local
anonymous voterId are claimed (transaction) by the UID, and if the
browser holds the poll's creatorToken, an ownerUid is attached to
the poll (one-time claim). Creator tools then key off ownerUid when
signed in, token as the legacy fallback.

### 11c. My polls synced to account

Status: done (26 Jul 2026, commit ae56655). Implemented: cloud copy
of the my-polls list in users/{uid} (utils/userPolls.js), entries in
a `polls` map keyed by poll ID so per-entry setDoc merges are safe
across devices; createdByMe is only ever written as true so the
flag stays sticky under merge semantics. Poll visits (throttled to
real changes, not every vote snapshot) and creations upsert the
account list; the homepage shows the union of local and cloud
(newest lastSeen wins the title), shows a "synced to your account"
hint, uploads local-only history once per account per mount
(syncLocalPollsUp, also trims past the 50-entry cap oldest-first),
and removal deletes from both lists. Signed-out behavior unchanged
(local list only). firebase-rules.txt gained a users/{userId} block
(owner-only read/create/update, polls map only, no delete), applied
by Adam. Verified in the browser: anonymous REST read of a user doc
gets PERMISSION_DENIED; with the local list cleared the homepage
restored all entries from the cloud with correct YOURS badges;
removing an entry stayed gone after reload (cloud deletion
confirmed); local backup restored afterwards.

Per-user poll list in Firestore (users/{uid} document), merged with
the localStorage list; the homepage shows the union and syncs new
visits/creations for signed-in users. Rules: only the owner reads
and writes their user document.

### 11d. Poll deletion by owner

Status: done (27 Jul 2026, commit ae56655). Implemented: deletePoll()
(plain deleteDoc; authorization lives in the rules), a danger zone
in the AdminBar with a two-step confirm delete button shown only to
the signed-in owner (other creators see "requires signing in as its
owner"), deletion navigates home and scrubs the poll from the local
and cloud my-polls lists, and a poll page hitting errPollNotFound
now drops the dead entry from both lists so dangling links self
clean. Rules: allow delete only when request.auth.uid equals the
poll's ownerUid (unclaimed anonymous polls stay undeletable);
applied by Adam. CLAUDE.md's "polls cannot be deleted" gotcha
updated. Verified in the browser: anonymous REST delete gets
PERMISSION_DENIED; two-step UI delete removed the poll from
Firestore (confirmed NOT_FOUND) and from the homepage list; a
fabricated dead list entry self-cleaned on visit. Cleanup done with
the new feature: test polls 8BJoLEAHEA, utY99RDlyn and the legacy
jH4ll0Viah ("Deadline test", auto-claimed on visit thanks to 11b)
all deleted; only the unclaimable RjwDCzmNa8 remains.

Signed-in owners can delete their poll (two-step confirm in the
AdminBar). Rules allow delete only when request.auth.uid matches
the poll's ownerUid. The my-polls lists handle dangling entries
gracefully.

### 11e. Poll auto-expiry

Status: done (28 Jul 2026, commits d091138 + 9f2e533). api/expire-polls.js
(Firebase Admin SDK, FIREBASE_SERVICE_ACCOUNT + CRON_SECRET Vercel
env vars set by Adam) deletes polls whose latest offered date is
older than EXPIRY_MONTHS (default 12, env-overridable); polls with
unreadable dates are skipped, batches capped at Firestore's 500.
vercel.json runs it daily at 03:14 UTC; Vercel sends the bearer
secret automatically, everything else gets 401 (verified). Verified
live end to end: a planted expired bait poll was deleted by a
manually triggered run (scanned 41, deleted exactly 1), real polls
untouched. Debugging note for posterity: a regenerated CRON_SECRET
was saved with trailing whitespace, which makes every Vercel BUILD
fail ("environment variable contains leading or trailing
whitespace"), silently pinning production to the old deploy; the
fix is a clean value plus redeploy. Deleted-poll list entries
self-clean via the 11d dangling-entry cleanup.

A Vercel cron (vercel.json) hits a serverless function using the
Firebase Admin SDK to delete polls whose latest date is more than
12 months in the past (window adjustable). Admin SDK bypasses
rules, so the function must verify a shared secret (CRON_SECRET)
sent by Vercel cron.
MANUAL (Adam): generate a Firebase service-account key and set it
plus CRON_SECRET in Vercel env vars.

### 11f. Hardening: rules + App Check

Status: done (27 Aug 2026). App Check ENFORCEMENT is ON for Cloud
Firestore. Full rollout completed with Adam: classic reCAPTCHA v3
key created (attached to the board-game-scheduler-81820 GCP
project; the project picker is now a normal part of key creation),
secret registered in Firebase App Check, VITE_RECAPTCHA_SITE_KEY
set in Vercel Production (marked Config/public, correctly so) and
local .env, redeployed. Verified BEFORE enforcing: real App Check
JWT minted (right aud, 1h TTL, auto-refresh), create/vote/delete
all green in the live app. Verified AFTER enforcing: tokenless
REST read now gets 403 PERMISSION_DENIED (previously 200/404),
while the live app still works end to end (test poll 8V5b3HWqXw
created, voted, owner-deleted under enforcement; the earlier
pre-enforcement test poll 4rAoKJ7wGz likewise cleaned up,
NOT_FOUND confirmed). Authentication API is in Monitoring mode
only, deliberately not enforced. Note: since REST reads are now
blocked by App Check, future sessions cannot use anonymous REST
probes to inspect polls; verify through the app or Admin SDK.
No code changes in this final rollout, so no commit was needed
(the .env change is local and gitignored).

History. Done earlier (29 Jul 2026), committed and pushed:
- Part 1 (commit 1c7a514): Firestore rules rewritten and APPLIED by
  Adam in the console. Owned polls (ownerUid present) are protected
  server-side (management, dates-list resize, game removal need the
  owner account); non-owners may only vote/comment (date count
  preserved), add <=1 game per write, or claim votes; deletion
  owner-only; identity immutable; ownerUid set-once; shapes/caps
  validated; create tightened; users/{uid} owner-only + map cap.
  Optional-field checks are presence-guarded so the pre-closed/
  pre-creatorToken legacy poll (RjwDCzmNa8) stays votable. Client
  (PollView, pollHelpers) mirrors the rules. VERIFIED: 16/16
  forged-vs-legit write cases pass against the live rules; owner
  rename works through the app.
- Part 2 (commit 1ba6134): App Check client wired in src/firebase.js
  (reCAPTCHA v3), DORMANT until VITE_RECAPTCHA_SITE_KEY is set, so
  current prod is unchanged. Debug token enabled in dev.

Decision history: on 29 Jul 2026 Adam doubted App Check was needed
and skipping enforcement (dormant wiring, budget alert, revisit on
abuse) was recommended; on 11 Aug 2026 Adam explicitly chose the
FULL rollout instead. Stage 1 below was explained to him click by
click on 11 Aug (classic key at google.com/recaptcha/admin/create,
score-based v3, the five domains, and a warning about the Google
Cloud Enterprise detour) but as of 18 Aug he has NOT yet reported
creating the key. Resume by asking whether the key exists, then
continue with the numbered steps. The secret key must never be
pasted into chat (Adam pastes it straight into the Firebase
console); the site key is public and fine to share.

Reference: reCAPTCHA v3 site key (public)
6LcVIZstAAAAALS9QqARyZ0SxVUhCIojMukw2-s9; the secret lives only in
the Firebase App Check console. Ops gotchas kept for posterity: the
PWA service worker serves the old bundle for one load after each
deploy (the update lands on the next reload); Vercel env values
must have no leading/trailing whitespace or every build fails.

### 11g. Privacy note

Status: done (27 Aug 2026, NOT yet committed; Adam commits/pushes
when ready and the push auto-deploys both Vercel projects).
Implemented: /privacy route (PrivacyPage.jsx on the shared card
style), fully translated EN/PL via the i18n dictionary, covering
what is stored (incl. optional account email and Google profile),
where (Google Firebase / Google Cloud, EU visitors included, plus
the reCAPTCHA v3 / App Check mention with the Google-required
"protected by reCAPTCHA" attribution links), how long (12-month
auto-expiry, constant mirrors api/expire-polls.js default), and
removal (owner deletion in the app; everything else by email). The
app gained its first global footer (MeppleTime + privacy link,
rendered on all routes; feature 15's donation link rides along
here later). Landing footer TODO slot filled with a bilingual
Prywatnosc/Privacy link to app.meppletime.today/privacy. Contact
email used: adam.jastrzebski@codelabs.pl (swap in PrivacyPage.jsx
if Adam prefers another address). Verified in the browser in both
languages (dev server, /privacy deep link, footer on the homepage,
landing link and its EN/PL toggle); vercel.json's SPA rewrite
already covers /privacy; lint and build green.

A short /privacy page in Polish and English: what is stored (poll
titles, dates, first names or nicks, votes, comments, optional
account email), where (Google Firebase, EU visitors included), how
long (auto-expiry window), and how to get data removed (contact
Adam; owners can delete their polls). Footer link on both pages.

Email deliverability follow-up: DONE (27 Aug 2026). Firebase Auth
now sends from noreply@meppletime.today: domain customized in
Authentication -> Templates, four DNS records added in Vercel
(apex SPF TXT v=spf1 include:_spf.firebasemail.com ~all, apex
firebase=... verification TXT, firebase1/2._domainkey DKIM CNAMEs
to firebasemail.com; adding them intentionally disables wildcard
matching for the _domainkey branch, which is harmless), Firebase
verification passed same day. Verified live by Adam: magic link
arrived IN THE INBOX (not spam) from the proper sender. The
Firebase public-facing name was also corrected from
"boardgame-scheduler" to "MeppleTime" (Project settings ->
General), which fixes the app name in the email subject and body.
The check-your-spam hint in the UI stays as a harmless safety net.

Acceptance criteria for the phase: signed-out experience unchanged;
sign-in works via Google and via magic link on desktop and phone;
identity and creator rights follow the account across devices;
owners can delete polls and deletion is rules-enforced; expired
polls disappear on schedule; App Check enforcement is on without
breaking real users; privacy page reachable in both languages.

## Phase 6: Pre-launch polish

### 13. Design system alignment (added 23 Jul 2026)

Status: blocked, waiting on Adam's visual identity work

Status update 27 Jul 2026: Adam delivered the design system as the
Claude Design project "Organic" (read directly via DesignSync:
theme.json + styles.css tokens). Pulled forward before 11e-11g on
purpose: the remaining phase 5 features are backend-only except the
privacy page, which should be born styled. Implemented: all Organic
tokens as Tailwind v4 @theme in src/index.css (ground/surface/ink,
neutral + terra + sage ramps, gold and danger semantic colors,
Caprasimo/Figtree via self-hosted @fontsource imported in main.jsx
because the Tailwind CSS pipeline does not rebase font URLs, radii
16/28px, ink-tinted shadows), full component sweep across all 17
JSX files (terra primary, sage creator tools and success, gold
maybe/warning, brick danger, pill buttons and inputs), dice burst
recolored, PWA icons regenerated (scripts/generate-icons.mjs,
terracotta die with cream pips), manifest theme #c67139 on #f5ead8,
fonts added to the SW precache (22 entries). Verified in the
browser: home, poll page, calendar both modes, matrix, game voting,
results, date modal, creator tools, EN and PL.
RESOLVED (27 Jul 2026, done, commit 780c29d): Caprasimo has NO
Polish diacritics (confirmed against both the fontsource build and
Google's hosted copy), so with Adam's approval the heading face was
swapped to Baloo 2 at weight 700, the closest Polish-capable match
to Caprasimo's chunky rounded personality. All Polish diacritics
verified present and headings render uniformly in both languages.
The Claude Design "Organic" project still names Caprasimo; if the
design system gets reused elsewhere, update it there too.

Brand addendum (27 Jul 2026, commit 722b281): Adam exported the
full brand doc to design-assets/MeppleTime Design System.html (the
Claude Design UI renders brand assets on the fly; they are not
files in the design project, hence the export). The product brand
is MeppleTime: a split calendar tile (sage left = the calendar,
terracotta right = the commitment, binder rings on top) with a
cream meeple straddling the seam, wordmark always Caprasimo with
Mepple in sage-700 and Time in terracotta-600. Implemented: the
mark as a faithful SVG port (src/components/shared/Logo.jsx, rings
auto-drop below 32px per the rules), header lockup replacing the
text title, Caprasimo reinstated for the wordmark only (pure ASCII,
so the Polish issue does not apply; UI headings stay Baloo 2),
ringless-SVG favicon, PWA icons regenerated from the real mark, app
renamed MeppleTime in index.html title/meta and the manifest.
NOTE: the brand doc also contains component specs and two full
product screens (sections 07-10) that diverge from the current app,
including features rejected on 15 Jul 2026 (time slots) and
unplanned ones (groups, nudges, auto-lock, batched voting). Not
implemented; awaiting Adam's decision on whether deeper alignment
becomes a new roadmap item.

Logotype refresh (3 Aug 2026): Adam delivered a new illustrated
logotype (design-assets/good-logotype.svg and .png): a shaded,
textured version of the split-calendar mark with the meeple, and
the wordmark set in Bogart Extrabold. scripts/generate-icons.mjs
was rewritten to derive every brand asset from that file via
headless Chrome: mark-only SVGs (the wordmark is live Bogart text
inside the SVG, which browsers cannot render, so it is stripped)
for the app header (src/assets/mepple-mark.svg via Logo.jsx), the
favicon (public/favicon.svg) and the landing page
(landing/assets/mepple-mark.svg, used in nav, hero and footer),
plus regenerated PWA icons (192/512 transparent, maskable 512 and
apple-touch 180 on cream). Wordmarks in the app and landing remain
Caprasimo live text: Bogart is a commercial font and is not
licensed for embedding. DECIDED (27 Aug 2026): Caprasimo stays
permanently (it is on Google Fonts under the SIL Open Font
License, free for commercial use and embedding); Bogart will not
be licensed. This is closed, not an open decision.
The old flat-geometry mark is fully retired. Verified in headless
Chrome (app header at desktop and 390px, landing hero/nav/footer,
favicon served); lint and build green.

### 14. Domain move + landing page (added 28 Jul 2026)

Status: done (29 Jul 2026, commit a21baf8; SPA-routing hotfix
c393387 discovered and shipped during this feature). Live layout:
www.meppletime.today serves the bilingual landing (its own Vercel
project, root directory landing/, framework Other, no build);
meppletime.today 308-redirects to www (www ended up primary, fine);
app.meppletime.today serves the app, deep links verified 200. The
landing is a self-contained landing/index.html on the Organic
tokens: EN/PL auto-detect plus toggle, brand hero, three steps,
washed real screenshots (scripts/capture-landing-shots.mjs staged
a demo poll, captured cards headlessly via puppeteer-core and the
demo poll was deleted), chips, sage brand band, footer with TODO
slots for 11g privacy and 15 donations. Verified live on desktop
and mobile in both languages.

Adam is buying meppletime.today. Target architecture: the apex (and
www) serve a small static landing page presenting MeppleTime as a
product; the app itself moves to app.meppletime.today as-is (own
Vercel project, poll links become app.meppletime.today/poll/...).
The landing is a separate tiny Vercel project built from the brand
doc (design-assets/) and the Organic landing template: product
pitch, screenshots, a big CTA into the app, marketing lockup rules
per the brand doc (sage-only lockup on marketing bands).
Sequencing: do this BEFORE 11f (App Check registers domains with
reCAPTCHA) and before 11g (the privacy page should name the real
domain). Recommended order: 11e -> 14 -> 11f -> 11g -> 15.
MANUAL (Adam): buy the domain (Vercel Domains is the zero-config
option; Porkbun or Cloudflare are the cheap ones, DNS-only mode on
Cloudflare); then in Vercel assign meppletime.today + www to the
landing project and app.meppletime.today to the app project; add
app.meppletime.today to Firebase Auth authorized domains. The old
boardlabs-scheduler.vercel.app URL keeps working for old links.

### 15. Optional donations (added 28 Jul 2026)

Status: done (27 Aug 2026, NOT yet committed; ships with 11g in one
push). PLATFORM CHANGE the same day: Adam dropped Ko-fi and chose
Buy Me a Coffee for the English side, so the pair is
https://buymeacoffee.com/halfhide (EN) and
https://buycoffee.to/halfhide (PL). On Adam's request the links are
visually distinct branded buttons, not text links, using each
platform's official identity, self-hosted in the repo (works
offline, no third-party requests): EN = Buy Me a Coffee's official
yellow button (cdn.buymeacoffee.com/buttons/v2/default-yellow.png,
saved as src/assets/bmc-button.png and landing/assets/); PL =
buycoffee.to's official white wordmark (their /img/brand/bc-logo.svg,
saved as buycoffee-logo.svg in the same places) on a black pill,
matching their own presentation. App: DonateButton.jsx renders the
right button from the i18n lang, URL still carried by the
dictionary's per-language donateUrl; footer is now button above a
"MeppleTime · Privacy" line. Landing: support section between FAQ
and the brand band plus a footer button, both buttons present in
markup and toggled per language via html[lang] CSS (.don-en /
.don-pl). Verified in the browser in both languages on both
surfaces, all images loading locally; lint and build green.
History note: Ko-fi was implemented first but its CDN refuses
hotlinked embeds (and this network cannot fetch it for
self-hosting), which Adam resolved by switching platforms.
Refinement (27 Aug 2026, on Adam's feedback): BOTH buttons now
show in BOTH languages (a Polish speaker may still prefer BMC and
vice versa), each prefixed with an emoji marker (earth for Buy Me
a Coffee = international, Polish flag for buycoffee.to = BLIK);
the buycoffee pill background changed from flat black (looked bad
on the cream theme) to the platform's signature green-to-magenta
brand gradient (#009052 -> #b43899; no other official logo color
variants exist, only the white wordmark); and the landing #support
section got the same 88px/56px top margin as the other sections
(it previously sat cramped under the FAQ). donateUrl left the i18n
dictionary; URLs live in DonateButton.jsx and the landing markup.
Final placement (same day, Adam's call): the support section moved
ABOVE the FAQ, so the landing order is hero -> three steps ->
features -> feature grid -> support -> FAQ -> brand band -> footer.

Monetization stays donation-only and fully optional: no payments in
the app itself, just links out to donation platforms, so no payment
processing or consumer-law burden lands on the app. Pragmatic combo
agreed with Adam: Ko-fi for the English UI, buycoffee.to for the
Polish UI (BLIK matters for Polish donors); the i18n dictionary
carries the per-language URL. Placement: a small "Support
MeppleTime" link in the app footer (the footer arrives with 11g's
privacy link; this rides along) and a support section on the
landing page (feature 14). Ships last, right before launch.
MANUAL (Adam): create the Ko-fi account and the buycoffee.to
account, then provide both links.

### 17. Bring a friend (added 10 Aug 2026 on Adam's request)

Status: done (10 Aug 2026). Votes carry an optional `guests` int
(0..MAX_GUESTS, capped at 9): a voter can bring along extra players
who count toward the player count without being named. Implemented:
addVote accepts a guests param (re-votes keep the count, a 'no'
clears it, omitted when 0 so legacy votes are untouched);
voteWeight() (1 + guests) drives getVoteSummary, getBestDates and
getCapacityStatus, so heatmap shading and counts, matrix totals,
results ranking and capacity badges all speak player counts now. UI:
a quiet "Bringing extra players?" minus/plus stepper in the date
modal (visible only for your own yes/maybe vote while voting is
open; no dice, no banner), "+N" suffixes on names in the voter
breakdown, matrix cells (✓+2), results cards and the finalize
banner, and "(+N)" on the you-voted chip. EN/PL strings added. NO
Firestore rules change needed: rules cannot inspect per-vote fields
(documented ceiling), so the existing shape validation already
admits the new field. Verified in the browser end to end on a
staged poll: voting yes then stepping to +2 showed 3 Yes in the
modal, 3(checkmark) in the heatmap cell and matrix totals, "Adam T
+2" in breakdown/matrix/results, and "Coming (3): Adam T +2" on the
finalize banner; test poll expired via the cron path afterwards.

Goal: reflect that people sometimes bring a spouse or friend; only
the player count matters, not who the guest is.

### 18. Branded splash screen (added 18 Aug 2026 on Adam's request)

Status: done (18 Aug 2026; extended same day on Adam's request:
display floor doubled to ~1.4s and the MeppleTime wordmark added
below the mark, Caprasimo with sage/terra split, system-font
fallback on cold first visits until the bundle's font loads). A
static splash lives directly in index.html (cream #f5ead8
full-viewport overlay, the illustrated mark at min(38vw, 170px)
with a gentle scale pulse, disabled under prefers-reduced-motion):
it paints with the app shell before React boots, which is exactly
the blank gap on mobile/PWA cold starts. main.jsx fades it out
after first paint once the floor has passed; the node is removed
after the transition. The mark is
referenced as /favicon.svg (already SW-precached), so installed
PWAs show it instantly; on a slow first-ever visit the cream paints
first and the mark pops in when loaded (accepted tradeoff to keep
the HTML shell lean). Android's native PWA splash already matched
(manifest background_color cream + icon). Verified in the browser
at 390px and desktop: splash shows, crossfades into the app, and
the DOM node is gone afterwards; lint and build green.

## Phase 6b: Pre-launch SEO (added 27 Aug 2026)

Source of truth for the reasoning: `SEO-AUDIT.md` (full audit of
27 Aug 2026, finding codes C1-C4, H1-H4, M1-M5, L1-L4 referenced
below). Adam approved the three features and their order as
proposed: 19 -> 20 -> 21 -> public launch. Public launch waits for
this phase.

### 19. SEO launch foundation

Status: done (27 Aug 2026, commit a6f8412). Live production
verification passed all acceptance criteria: X-Robots-Tag noindex
present on the app root and poll routes, ABSENT on /privacy;
app robots.txt serves as text/plain; landing robots.txt +
sitemap.xml live (application/xml); og-card.png 200 on both
hosts; canonical, OG tags and both JSON-LD blocks in the live
landing HTML. Implementation details: landing robots.txt +
sitemap.xml (static files in landing/); app public/robots.txt
(served before the SPA rewrite, crawl allowed so the noindex
headers are visible); vercel.json X-Robots-Tag noindex headers on
every app path EXCEPT /privacy; new branded 1200x630 share card
(scripts/generate-og-image.mjs -> landing/assets/og-card.png,
copied to app public/og-card.png); full OG + Twitter tags on the
landing (localized-alternate og:locale) and a generic card on the
app shell so shared poll links preview; JSON-LD WebApplication +
FAQPage on the landing (parse-validated); keyword-targeted titles
and descriptions in EN and PL, em-dashes removed from live
strings; landing self-canonical, and a CanonicalTag component in
the app (root -> landing, /privacy -> self, poll routes none,
verified in the browser). Lint + build green. AFTER the push:
verify X-Robots-Tag on app routes (must be absent on /privacy),
robots/sitemap live on both hosts, and a messenger link preview.

The crawler-facing blockers, in one feature (audit findings C2, C3,
C4, H1, H2, M4):
- robots.txt + sitemap.xml on the landing; a real static
  robots.txt in the app's public/ so the SPA rewrite stops serving
  HTML for it (C2).
- Open Graph + Twitter Card tags with a branded share image on the
  landing, and a generic branded card on the app shell so shared
  poll links preview properly (C3). Note: this deliberately
  un-rejects only the OG-tags slice of the "richer share options"
  rejection of 15 Jul 2026; QR codes and share buttons stay
  rejected. Per-poll dynamic previews are NOT in scope (phase 7
  candidate).
- noindex the app (robots meta + X-Robots-Tag), keep /privacy
  indexable, canonical app root -> landing (C4).
- JSON-LD on the landing: FAQPage from the existing FAQ,
  WebApplication, Organization with logo (H1).
- Keyword-targeted title + meta description, no em-dashes, under
  ~60/155 chars (H2); self-canonicals (M4).

Acceptance criteria: robots.txt and sitemap.xml return valid
content on both hosts; a landing link pasted into a messenger
shows a branded card; Google's Rich Results test recognizes the
FAQPage; the app root is noindexed and canonicalized while
/privacy stays indexable.

### 20. Bilingual landing URLs

Status: implemented, awaiting push (27 Aug 2026). Architecture:
landing/index.html stays the single source of truth (EN markup +
the STRINGS dictionary); scripts/generate-pl-landing.mjs loads it
in headless Chrome, applies setLang('pl'), localizes the head
(canonical /pl/, og:url and locales, PL OG/Twitter copy, PL
JSON-LD WebApplication + FAQPage) and writes the fully static
landing/pl/index.html, which is COMMITTED (the landing project
has no build step). IMPORTANT for future sessions: after ANY
landing copy change, re-run node scripts/generate-pl-landing.mjs
or the Polish page goes stale. Asset paths switched to absolute
(/assets/...) so both URLs share them. hreflang links (en, pl,
x-default) on both pages; both URLs in sitemap.xml. The language
toggle now NAVIGATES between / and /pl/ and saves the choice; a
head script routes by saved choice, and only a first-visit Polish
browser on / is auto-sent to /pl/. The PL page never redirects on
browser language alone, so Googlebot (en-US) can index it.
Verified locally in the browser: static Polish via curl (no JS),
toggle both directions, saved-choice routing both directions, PL
JSON-LD parse-validated. Verify live after push.

Fixes C1, the biggest strategic gap: Polish content is invisible
to crawlers. Build a real /pl/ version of the landing with the
Polish translations baked into the HTML (title, meta, body,
localized JSON-LD), correct lang attributes, hreflang link pairs
(en, pl, x-default) on both versions, and both URLs in the
sitemap. The existing JS language toggle stays as a convenience
(switching navigates between the two URLs). The translation
dictionary already in landing/index.html is the content source.

Acceptance criteria: fetching /pl/ with JS disabled shows full
Polish content; hreflang validates; both versions self-canonical;
the language toggle navigates between URLs and preserves scroll
position sensibly; sitemap lists both.

### 21. Performance pass

Status: not started

Audit findings H3, M1, M2, L1, L2 plus optional H4:
- Self-host the landing fonts (subset, font-display swap, preload
  the two critical faces) instead of render-blocking Google Fonts
  CSS; ~2s estimated LCP savings (H3).
- Optimize mepple-mark.svg with SVGO and preload it (it is the LCP
  element, 36KB used three times) (L1); add an apple-touch-icon to
  the landing (L2).
- Screenshots to WebP with width/height attributes, loading=lazy
  below the fold (M1).
- Fix the WCAG AA contrast failures (terra buttons, kickers,
  language toggle on cream) (M2).
- Stretch, only if time allows: app code-splitting and lazy
  Firebase init to cut the 7.2s mobile first paint (H4).

Acceptance criteria: landing Lighthouse mobile performance >= 95
with FCP < 1.5s and LCP < 2.5s; accessibility 100; both themes of
buttons pass AA contrast; no regression in either language.

## Phase 7: Post-launch

Post-launch SEO candidates (from SEO-AUDIT.md, 27 Aug 2026, not
yet scheduled): a small content layer of EN/PL guides linking to
the app (finding L4, builds topical authority for the new .today
domain), and per-poll dynamic OG previews so each shared poll
renders its own card.

### 16. Enriched my-polls list (added 29 Jul 2026)

Status: not started (post-launch; prioritize against real usage data
once the app is public)

Origin: a "dashboard as the main view" idea from Adam, evaluated
critically on 29 Jul 2026 and rejected in that form (see rejected
list). MeppleTime is link-first (most users arrive via a shared poll
link and never see the homepage), a typical user has one or two
active polls, and the homepage already carries the create form plus
the "Your polls" list. But the underlying need is real: "which of my
polls need something from me, and when am I playing next?" This
feature captures most of the dashboard's value inside the existing
list instead of a new main view.

Scope:
- Enrich the existing "Your polls" homepage list entries with poll
  status: voting open and you have not voted yet; voting closes soon
  (deadline approaching); voting closed; and, most valuable, an
  upcoming finalized game night line ("You're playing Wingspan on
  Friday"), with the leading/chosen game when one exists.
- No live per-poll reads on homepage load: store a small status
  snapshot on the list entry (localStorage and the users/{uid} cloud
  map) whenever a poll is visited, refreshed opportunistically on
  later visits. Staleness between visits is the accepted tradeoff.
- Same screen and mental model as today; no new route, no dashboard
  view. If groups or recurring nights ever become features, revisit
  a true dashboard then, seeded by this list.

Acceptance criteria:
- Entries show correct status after visiting a poll, survive reload,
  and sync across devices for signed-in users; entries without a
  snapshot render exactly as today; homepage load performs no poll
  document reads; works in EN and PL.

## Rejected features (do not build unless Adam changes his mind)

- Time slots (time-of-day options): rejected 15 Jul 2026.
- Calendar export (.ics / Google Calendar): rejected 15 Jul 2026.
- Richer share options (QR, WhatsApp buttons, OG tags): rejected
  15 Jul 2026.
- Dark mode: rejected 15 Jul 2026.
- Dashboard as the main view: rejected 29 Jul 2026. Link-first app,
  few active polls per user, homepage list already covers the need;
  the useful core was scoped down into feature 16 instead.

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
- 23 Jul 2026: phase 5 planned with Adam and expanded into
  sub-features 11a-11g (Google + magic link sign-in, fully optional;
  identity merge; synced my-polls; owner deletion; auto-expiry;
  rules + App Check hardening; privacy note) targeting a public
  launch.
- 26 Jul 2026: feature 11a (auth foundation) implemented: Firebase
  Auth wiring, AuthProvider with Google popup + email magic link
  (cross-device re-prompt included), header sign-in modal and
  account menu, EN/PL strings. UI and error paths verified in the
  browser; real sign-in flows blocked until Adam enables the Google
  and Email link providers in the Firebase console. No Firestore
  rules changes in this sub-feature.
- 26 Jul 2026 (later): Adam enabled both providers; 11a verified end
  to end and marked done. Google popup sign-in, magic link sign-in
  (email fetched from spam), account menu, sign-out, and reload
  persistence all confirmed in the browser. Firebase auth emails
  land in spam: bold check-your-spam warning added to the link-sent
  confirmation (EN/PL), and a proper deliverability fix (custom
  sender domain or SMTP relay) recorded as a post-launch follow-up
  in phase 5.
- 26 Jul 2026: feature 11b (identity merge and ownership claim)
  implemented and verified end to end in the browser (vote claiming,
  signed-in creation, ownership claim from the browser token,
  creator tools running on the account alone with the token
  deleted). firebase-rules.txt extended for set-once ownerUid and
  ALREADY APPLIED by Adam in the console. Two labeled test polls
  added to the live database (utY99RDlyn, 8BJoLEAHEA); clean up
  after 11d.
- 26 Jul 2026: feature 11c (my polls synced to account) implemented
  and verified in the browser: users/{uid} cloud list, homepage
  union of local and cloud lists, one-time upload of local history,
  removal from both, owner-only access rules (applied by Adam,
  anonymous read confirmed PERMISSION_DENIED). Signed-out behavior
  unchanged.
- 27 Jul 2026: feature 11d (poll deletion by owner) implemented and
  verified: owner-only delete rule (applied by Adam), two-step
  confirm in the AdminBar, list scrubbing and dangling-entry self
  cleanup. All deletable test polls removed from the live database
  using the new feature; RjwDCzmNa8 remains (unclaimable).
- 27 Jul 2026: feature 13 (design system alignment) pulled forward
  and completed: Adam's "Organic" design system read directly from
  Claude Design, expressed as Tailwind @theme tokens, full component
  sweep, recolored dice, regenerated PWA icons and manifest colors,
  self-hosted fonts precached for offline. Heading font swapped
  Caprasimo -> Baloo 2 (Caprasimo lacks Polish diacritics), approved
  by Adam. Verified in the browser in both languages.
- 28 Jul 2026: planned with Adam: feature 14 (meppletime.today
  domain + landing page, app moves to app.meppletime.today) and
  feature 15 (donation links: Ko-fi on the English UI, buycoffee.to
  on the Polish UI). Launch order fixed as 11e -> 14 -> 11f -> 11g
  -> 15 -> public launch.
- 28 Jul 2026: feature 11e (poll auto-expiry) implemented and
  verified live (bait poll deleted by a manual cron-secret run,
  real polls intact, unauthorized calls 401). Domain hooked up
  early: app.meppletime.today and the apex both serve the app
  (Adam added both to Firebase authorized domains); the apex
  repoints to the landing in feature 14.
- 18 Aug 2026: feature 18 (branded splash screen) implemented and
  verified: static in-shell splash with the illustrated mark, fading
  into the app after first paint, instant on installed PWAs via the
  existing SW precache. Requested by Adam as pre-launch polish.
- 10 Aug 2026: investigated Adam's "cross-month polls only show one
  month" report. NOT a display bug: calendar, matrix and results all
  handle multi-month polls correctly (verified with a staged Aug-Sep
  poll and a form-created one, both months rendered with all dates).
  Root cause: Adam's real poll (5IuA3W_jpB) was created with end
  date 31 Aug, so September dates never existed; the segmented
  native date input makes such mis-entry easy and the form gave no
  feedback. Hotfix shipped: a live bilingual range preview under the
  date inputs ("Voters will see 14 dates: Mon, Aug 24, 2026 to Sun,
  Sep 6, 2026", proper Polish plurals, too-long warning inline).
  Repairing the live poll is owner-only (it has ownerUid): Adam adds
  the missing September dates via the AdminBar. Test polls expired
  via the cron path.
- 10 Aug 2026: feature 17 (bring a friend) implemented and verified
  in the browser: optional per-vote guest count feeding all player
  counts (heatmap, matrix, results, capacity, finalize banner) via
  voteWeight(), with a small stepper in the date modal. No rules
  change needed. Test poll routed through the cron cleanup.
- 3 Aug 2026: landing page expanded and visually reworked on Adam's
  request (feature 14 follow-up): kicker labels, hero stickers,
  tilted screenshot cards with blob backdrops, a six-cell "Everything
  for game night" grid replacing the chips row, and a six-question
  FAQ, all bilingual; landing favicon switched to the new mark. The
  heatmap screenshot was recaptured at a narrow viewport so the
  calendar fills its card (the old wide capture needed a hacky CSS
  crop, now removed). New reusable script scripts/stage-demo-poll.mjs
  stages the labeled demo poll for captures and afterwards rewrites
  its dates to Jan 2024 so the nightly expiry cron deletes it (poll
  nMmOKtqi69 staged and expired this way; gone after the next 03:14
  UTC run). Verified headlessly: desktop and 390px, EN and PL, no
  horizontal overflow.
- 3 Aug 2026: Adam's new illustrated logotype implemented across the
  app header, favicon, PWA icons and the landing page (recorded as a
  feature 13 addendum). generate-icons.mjs now derives all brand
  assets from design-assets/good-logotype.svg. Wordmarks stay
  Caprasimo text; the logotype's Bogart Extrabold face is
  commercial and unlicensed, flagged to Adam as an open decision.
- 27 Aug 2026: SEO audit run before public launch (report in
  SEO-AUDIT.md): Polish content unindexable, robots/sitemap
  missing or broken, no social preview tags, user polls indexable.
  Adam approved turning it into phase 6b (features 19, 20, 21,
  in that order) as the last gate before launch.
- 27 Aug 2026: email deliverability fixed: Firebase Auth mail now
  sends from noreply@meppletime.today (SPF + DKIM via four DNS
  records in Vercel, domain verified) and the Firebase
  public-facing name corrected to MeppleTime. Verified live: magic
  link in the inbox, proper sender. The last pre-launch loose end
  is closed.
- 27 Aug 2026: font decision closed: wordmarks stay Caprasimo
  permanently (SIL OFL via Google Fonts, free for commercial use);
  Bogart will not be licensed.
- 27 Aug 2026: feature 15 (donations) implemented and verified in
  both languages, then reworked the same day on Adam's request into
  branded buttons with official platform identities, and the EN
  platform switched from Ko-fi to Buy Me a Coffee
  (buymeacoffee.com/halfhide; PL stays buycoffee.to/halfhide).
  ALL pre-launch features are now done; MeppleTime is ready for
  public launch once Adam commits and pushes (one deploy covers
  11g + 15).
- 27 Aug 2026: feature 11g (privacy note) implemented and verified
  in both languages: /privacy page, the app's first global footer
  with the privacy link, landing footer link filled in. Phase 5 is
  complete pending Adam's commit/push. Only feature 15 (donations)
  remains before public launch.
- 27 Aug 2026: feature 11f completed and App Check ENFORCEMENT
  enabled on Cloud Firestore. reCAPTCHA v3 key created, provider
  registered, site key deployed via Vercel env; tokens verified
  flowing before enforcement, and after enforcement the live app
  was re-verified end to end (create/vote/delete green) while
  tokenless REST requests are now rejected with PERMISSION_DENIED.
  Remaining before launch: 11g (privacy note), 15 (donations).
- 29 Jul 2026: Adam's "dashboard as the main view" idea discussed
  and rejected in its full form; the useful core (poll status and
  next game night surfaced on the existing "Your polls" list) added
  as feature 16 in a new post-launch phase 7. Launch order and the
  remaining pre-launch work (11f, 11g, 15) unchanged.
