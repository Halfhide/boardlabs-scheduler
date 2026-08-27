# MeppleTime SEO Audit

Date: 27 Aug 2026. Audited surfaces: the landing (www.meppletime.today,
static HTML, the intended SEO surface) and the app
(app.meppletime.today, client-rendered React SPA). Method: live-page
inspection (HTML, headers, DNS, redirects), Lighthouse 12 runs
(mobile emulation, local headless Chrome), and asset analysis.

## Verdict in one paragraph

The landing passes Lighthouse's shallow SEO check with 100, but that
check only proves the basics exist (title, description, lang, viewport).
Strategically the site is nearly invisible: Polish content cannot be
indexed at all, there is no sitemap or robots.txt, no social preview
tags on a product whose core loop is sharing links, no structured
data, and real user polls are currently indexable by Google. None of
this is hard to fix, and almost all of it is best fixed BEFORE launch,
because first impressions with crawlers (and first shared links)
compound.

## Scores (Lighthouse 12, mobile)

| Surface | Performance | Accessibility | SEO |
|---|---|---|---|
| Landing (www) | 84 | 96 | 100 |
| App (app subdomain) | 59 | not run | 92 |

Landing metrics: FCP 2.9s, LCP 3.7s (hero mark SVG), TBT 0ms,
CLS 0.003. App metrics: FCP 7.2s, LCP 7.3s, TBT 20ms.

## Findings

### Critical (launch blockers for "top-notch SEO")

**C1. Polish content is invisible to search engines.**
The landing is one URL with JS-swapped translations; the HTML source
is English and `<html lang="en">` is static. Crawlers index the
English content only; the Polish text exists solely after a
client-side click. For a product whose first users are Polish, the
Polish market is unreachable via search. Fix: real per-language URLs
(`/` for EN and `/pl/` for PL, or language subdomains), each with
translated HTML baked in (title, meta description, body), correct
`lang` attributes, and `hreflang` link pairs (en, pl, x-default) on
both versions. The current JS toggle can stay as a convenience on top.

**C2. robots.txt and sitemap.xml are missing or broken.**
The landing 404s on both. The app is worse: its SPA rewrite serves
the HTML shell for `/robots.txt` and `/sitemap.xml` with HTTP 200,
which gives crawlers an unparseable robots file (treated as
crawl-everything) and a fake sitemap. Fix: static `robots.txt` and
`sitemap.xml` on the landing (sitemap lists the per-language URLs
from C1); real static `robots.txt` on the app (a file in `public/`
is served before the SPA rewrite, so this is a one-file fix).

**C3. No Open Graph or Twitter Card tags anywhere.**
MeppleTime's core loop is "share one link", and today every shared
link (landing or poll) renders as a bare URL in WhatsApp, Messenger,
Slack and iMessage: no image, no title card. This suppresses the
product's only viral channel and looks unpolished. Fix: OG + Twitter
tags with a branded share image on the landing (per language), and a
generic branded card on the app shell so shared poll links preview as
"MeppleTime: vote on our game night" (per-poll dynamic previews are a
separate, optional, later step). Note: "richer share options (QR,
WhatsApp buttons, OG tags)" was rejected on 15 Jul 2026; the
recommendation is to revisit ONLY the OG-tags slice, since the
rejection context was in-app share UI, not launch SEO.

**C4. Real user polls are indexable.**
The app has no robots meta tags and Google renders JavaScript, so
actual polls (titles, participant first names, comments) can end up
in search results. This is both an SEO problem (thin duplicate
shells) and a privacy problem that the new privacy page implicitly
promises against. Fix: `noindex` on the app by default (robots meta
in the shell plus `X-Robots-Tag` header, with robots.txt from C2),
and canonical pointing the app root at the landing. Decide separately
whether `/privacy` should remain indexable (recommended: yes, exclude
it from noindex).

### High

**H1. No structured data.**
Zero JSON-LD on either surface. The landing already has a six-question
FAQ, which is a ready-made `FAQPage` schema (rich result eligibility);
add `WebApplication` (name, description, free pricing, screenshot)
and `Organization` (logo) markup. Once C1 splits languages, each
version carries its own localized schema.

**H2. Title and meta descriptions are not keyword-targeted.**
Current title: "MeppleTime (em-dash) plan your board game night". It
also contains an em-dash, which violates the workspace writing rule.
Neither title nor description targets what people actually search:
EN "board game night planner", "game night scheduler", "date poll for
board games"; PL "ankieta terminu", "planowanie wieczoru planszówek",
"kiedy gramy w planszówki". Fix: rewrite per-language titles and
descriptions around one primary query each, keep them under ~60/155
characters, no em-dashes.

**H3. Landing performance: render-blocking fonts cost ~2s of LCP.**
Google Fonts CSS (three families) blocks first paint; Lighthouse
estimates 2,000ms savings. The app already self-hosts fonts via
Fontsource; the landing should do the same (subset, `font-display:
swap`, preload the two critical faces). Also: the LCP element is
mepple-mark.svg (36KB); optimize it with SVGO and preload it. Target:
FCP under 1.5s, LCP under 2.5s on mobile.

**H4. App performance: 7.2s first paint on emulated mobile.**
The splash screen masks this visually, but voters on slow connections
wait a long time, and Core Web Vitals of any indexed app URL suffer.
Main costs: the single 1.1MB JS bundle (Firebase, all routes) parsed
before render. Fix directions: code-split routes and Firebase imports,
lazy-init App Check and Auth after first paint. Lower priority than
the landing (the app should not rank), but real UX value.

### Medium

**M1. Screenshot images are PNG without dimensions.**
~135-215KB savings available via WebP/AVIF; `width`/`height`
attributes missing (Lighthouse unsized-images); below-fold screenshots
should get `loading="lazy"` and a `srcset` for DPR variants.

**M2. Color contrast failures (accessibility, trust-adjacent).**
Lighthouse flags the terra primary buttons, the kicker labels, and
the language toggle as below WCAG AA contrast on the cream ground.
Fix: darken the text/background pairs slightly (terra-700 on cream,
or heavier weight); verify with the same audit.

**M3. Redirect chain to the canonical host takes two hops.**
`http://meppletime.today` redirects to `https://meppletime.today`,
then to `https://www.meppletime.today`. One combined hop is cleaner
for crawl budget and latency; check Vercel domain settings (minor).

**M4. No canonical tags.**
Add self-canonicals to each landing language version (with C1) and
the app-to-landing canonical (with C4).

**M5. The privacy page exists only after JavaScript runs.**
Google will render it, other crawlers and AI assistants will not. If
the trust signal matters for launch PR, prerender `/privacy` to
static HTML; otherwise accept Google-only indexing.

### Low

**L1.** `mepple-mark.svg` is 36KB and used three times on the landing;
run it through SVGO (likely 50%+ smaller) since it is the LCP element.

**L2.** The landing lacks an `apple-touch-icon` (the app has one).

**L3.** Em-dashes exist in live strings (`docTitle` both languages,
title tag); replace with a colon or rephrase per the workspace rule.

**L4.** Content depth: one landing page on a brand-new `.today` domain
means little topical authority. Post-launch, consider a small content
layer (EN and PL guides like "how to plan a board game night",
"najlepsze planszówki na 4 osoby") that links to the app. This is a
strategy item, not a launch blocker.

## What is already good

Clean single H1 and logical heading structure; descriptive alt text
on the meaningful screenshots; tiny HTML payload (32KB landing); CLS
near zero; HTTPS everywhere with HSTS-eligible redirects; fast static
hosting on a global CDN; accessible FAQ markup (native `details`);
bilingual UX (the problem is only that crawlers cannot see half of
it); the app correctly lives on a subdomain so app noise can be
isolated from the ranking surface.

## Proposed roadmap items (for approval)

- **Feature 19: SEO launch foundation** (blockers: C2 robots +
  sitemaps, C3 OG/Twitter cards + share image, C4 app noindex +
  canonicals, H1 structured data, H2 titles/descriptions, M4).
  Roughly one working session.
- **Feature 20: Bilingual landing URLs** (C1: `/pl/` version with
  baked-in translations, hreflang pair, localized schema and metas;
  builds on the existing dictionary). One session.
- **Feature 21: Performance pass** (H3 self-hosted fonts + SVG
  optimization on the landing, M1 image formats and sizing, M2
  contrast fixes; optionally H4 app code-splitting as a stretch).
  One session.
- **Post-launch, phase 7 candidate: content layer** (L4) plus
  optional per-poll OG previews.

Suggested order: 19 then 20 then 21, then launch. 19 and 20 change
what crawlers first see of the site; 21 changes how fast it feels.
