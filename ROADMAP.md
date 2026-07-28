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
| 11f | Rules + App Check  | 5     | not started |
| 11g | Privacy note       | 5     | not started |
| 13 | Design system align | 6     | done        |
| 14 | Domain + landing    | 6     | not started |
| 15 | Donations           | 6     | not started |

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

Status: done (28 Jul 2026, commit pending). api/expire-polls.js
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

Status: not started

Firestore rules rewritten: strict shape validation and size caps
everywhere, ownership checks wherever auth is present (poll
management by ownerUid, user docs, vote claims). Firebase App Check
with reCAPTCHA v3 enforced on Firestore so only the real app can
talk to the database.
MANUAL (Adam): register the app for App Check in the Firebase
console (reCAPTCHA v3 site key), then enable enforcement AFTER the
App Check client code is deployed and confirmed working (enforcing
too early locks everyone out).

### 11g. Privacy note

Status: not started

A short /privacy page in Polish and English: what is stored (poll
titles, dates, first names or nicks, votes, comments, optional
account email), where (Google Firebase, EU visitors included), how
long (auto-expiry window), and how to get data removed (contact
Adam; owners can delete their polls). Footer link on both pages.

Post-launch follow-up (agreed 26 Jul 2026, not part of the phase):
Firebase's magic-link emails land in spam (confirmed with Adam's own
mailbox; the sender is the default noreply@<project>.firebaseapp.com).
Accepted for now; the UI warns users to check spam after sending a
link. Some time after the public release, improve deliverability:
customize the sender in Firebase Auth email templates to a domain
Adam controls (requires DNS SPF/DKIM records) or route auth mail
through a proper SMTP relay.

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

### 14. Domain move + landing page (added 28 Jul 2026)

Status: not started (waiting for Adam to buy meppletime.today)

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

Status: not started

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
