# MeppleTime: trusted identity release

Reference: the existing MeppleTime app, PL/EN, 1440 px desktop and 390 px phone, plus the feature 22 availability table. This release integrates the emulator prototype into the application repository. It is not a deployment of the standalone prototype.

## What ships together

- New polls use server-verified guest/account identity and server-only pollsV2, usersV2, receipts and identity indexes. Vercel functions verify Firebase ID tokens and App Check before writing. Public poll reads still require App Check; private history requires the caller's ID token.
- Guest-to-account migration preserves votes, withdrawals, comments, game activity, ownership and history. Discovery pages the guest's durable participation index and history. Forgetting a bookmark cannot hide participation from migration. Large manifests are stored as separate documents, not a bounded array.
- A 90-second worker lease prevents simultaneous tabs fighting over every record. A failed function can be retried after the lease expires. Small transfers process two items per request; larger transfers process twenty. The function timeout is 60 seconds.
- Destination recovery accepts only the originally selected account. Temporary candidate credentials stay in memory. Lost source credentials cannot authorize a transfer.
- The existing availability table changes from commit 48cf9cb remain included. Deadline reopening behavior is preserved. Ownership changes wake background tabs immediately.
- Older polls retain their URLs and legacy storage. They are not silently converted into verified records. Unowned legacy creator controls are unavailable because the public creator token is not ownership evidence. Existing signed-in owners retain controls. Legacy votes still use the legacy model and its existing rules; this release does not claim to have secured old array-based records against direct malicious writes.
- Legacy account history remains visible. Local bookmarks for new polls are imported as visits, with ownership derived from the server. A failed history refresh now has a visible retry message.
- The expiry function includes both old and new poll collections. New API reads refresh after writes, focus and identity changes, with 3-second foreground and 30-second background polling. This avoids requiring new client Firestore permissions; it changes the read cost/latency compared with a Firestore listener.

## Deployment requirements

No new Firestore rules deployment is required for v2: the current rules deny client access to the new collections and the API uses Admin SDK access. Do not replace live rules with the old standalone emulator rules.

The Vercel app project must already provide FIREBASE_SERVICE_ACCOUNT, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_APP_ID and VITE_RECAPTCHA_SITE_KEY. Existing CRON_SECRET remains required for expiry. Never place server credentials in a VITE_ variable or commit them.

Firebase must have Anonymous Auth, email-link sign-in and Google enabled, with app.meppletime.today authorized. The server service account needs its existing Firestore read/write rights, Firebase Auth user-read rights (revocation checks), and read access to project Auth configuration for the build gate. App Check verification is mandatory at runtime. Real OAuth and email delivery require separate live verification.

Production builds run scripts/check-production.mjs before Vite. It checks required settings and reads provider/domain configuration, Auth and Firestore without changing cloud data. It refuses emulator/debug flags, mismatched projects and missing providers. A refused build must be fixed, not bypassed. This gate has not yet been executed against the live project in this session because cloud authentication is unavailable.

Trusted APIs refuse Vercel Preview, since existing previews share production Firestore. Use the emulator suite for synthetic writes. Do not use a preview deployment as a staging database.

## Publish path

Local branch: feature/trusted-identity-release, based on feature 22 (48cf9cb). GitHub main was 4c37022 when checked on 7 October 2026; PR #10 for feature 22 is still open. A combined PR from this branch includes that feature. Do not separately cherry-pick the prototype root commit df88c7e.

The repository requires PR/CI and squash merge. Pushing a feature branch alone does not deploy production. After the cloud prerequisites are verified, push this branch, open the combined PR, wait for CI, then merge through the normal protected-main workflow. Close superseded PR #10 after the combined change is merged. Do not disable branch protection to make this a direct push.

Vercel deploys the frontend and four API handlers from the same repository revision. The landing project has no intentional content changes. After promotion check the live home page and provider sign-in, create/vote/comment/transfer only in an explicitly authorized disposable smoke scenario, and remove its poll afterward.

## Rollback

Before new v2 polls exist, the previous Vercel deployment can be restored without data changes. Once people have created v2 polls, reverting to the pre-v2 frontend would hide their links: prefer a forward fix or keep the v2 reader/API while reverting the affected feature. Never delete v2 data or receipts as rollback. Old tabs keep their legacy code and legacy polls; refresh is needed to open newly shared v2 polls. No automatic conversion or destructive migration of existing legacy polls is performed.

## Reproduce checks

Node 22 and Java 21 are used locally. npm ci, npm test, npm run lint, npm run build. npm run test:security runs the emulator tests; it uses firebase-tools 15.29.0. Set FIREBASE_CLI_TOOL to an existing CLI file to avoid downloading it. Browser suites use installed Chrome; CHROME_EXECUTABLE can override the macOS default. Run one emulator suite at a time.

CI runs unit checks, lint, the backend security/migration emulator suite and build. Browser scripts and quality screenshots are under tests/security and tests/results respectively; generated results are not committed. The local workspace runner is ../../projects/meppletime/run-release-check.sh.

## Review findings addressed

1. Copying the old prototype would revert feature 22: retained current VoteMatrix and its translations/callbacks.
2. Copying the prototype would regress deadline reopening: retained the current deadline-aware action.
3. Localhost-only endpoints cannot run on Vercel: added deployable handlers and lazy server credentials.
4. Direct reads of v2 would fail under live rules: added attested API reads and private history reads.
5. Unverified requests could bypass browser controls: server derives identity, rejects extra fields and verifies App Check.
6. A 500-row cap could freeze migration: replaced it with paged discovery and item documents.
7. Scanning the whole app for every guest would scale poorly: indexed participation per identity, retained after forgetting a bookmark.
8. Concurrent workers repeatedly contended: added an expiring lease and bounded retry hints.
9. Background tabs showed stale owner controls: refresh on auth changes, focus and visibility changes.
10. Trusted-only history hid old links: merged legacy account history and retained local legacy bookmarks.
11. A local created-by-me flag could invent ownership: imports call the server visit operation.
12. Expiry ignored v2 polls: added both collections and tests.
13. Missing providers or credentials could replace a working deployment: added a read-only production build gate.
14. A failed history read looked like an empty account: added a localized error state.
15. The privacy page omitted guest identity, retained operation records and Vercel processing: corrected the factual PL/EN description and distinguished poll expiry from other records.
16. A legacy 10-character ID can begin with v2_: the client recognizes the complete new 19-character format, verified with old-prefix links.

## Local verification and reference comparison, 7 October 2026

- 54 unit tests passed; lint and the client production build passed. Existing large-chunk and outdated Browserslist warnings remain. The production cloud gate is skipped outside Vercel production and was not validated live.
- 48 integrated browser checks passed: recovery 7, email 6, identity 7, device/tabs 7, failures 6, Google emulator 8, participation UI 7. Six backend checks passed under the repository's actual rules, including a 604-poll fixture, 504 transferred records, paged history/index discovery, concurrent requests, expired leases and idempotent retries.
- 72 full screenshots plus 16 panel details cover PL/EN at 1440/390. Full screens were inspected; the privacy screens were inspected again after their final copy correction. Main flows were exercised in Chrome against local Auth/Firestore. Tests include empty, error and long-content states, old links beginning with v2_, verified legacy owners and combined history.
- Reference home views retain the same logo, Baloo/Figtree typography, warm surfaces, orange actions, rounded cards and layout. Differences are the new consent/recovery panels, verified ownership behavior, wrapping history titles, history errors and expanded privacy text. The feature 22 matrix intentionally scrolls within its own container on phones; the page does not scroll horizontally. Native date placeholders still follow the browser locale, as in the reference. Existing vote celebration animations can appear in screenshots; they are not debug overlays.
- The local review produced no console/page/HTTP errors or failed requests and no measured page overflow/clipped controls. The automated read-only reference observed reCAPTCHA cancellations and App Check 403 responses; these are recorded in screen-check.json and are not a diagnosis of a general production outage.
- Evidence: tests/results/*-result.json and [local review gallery](tests/results/quality/review-gallery.html). Generated evidence is local and ignored by Git. Screens contain explicitly synthetic emulator data, not production records. Runners clear that data on exit.

Not verified: live provider/configuration permissions, production App Check, real OAuth/email delivery, Safari, physical phones and complete accessibility conformance. Poll/history reads add polling traffic. Operation/migration records have no automatic expiry; deletion of a poll does not delete these records. These limits are not concealed by the passing emulator suite.

## Sources for platform integration

[Vercel Node.js functions](https://vercel.com/docs/functions/runtimes/node-js), [Firebase backend App Check verification](https://firebase.google.com/docs/app-check/custom-resource-backend), [Auth configuration fields](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/Config).
