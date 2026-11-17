// Generates the static guide pages of the landing (feature 24), plus
// the files that list them: landing/sitemap.xml, landing/llms.txt and
// the branded landing/404.html. Content lives in scripts/guides/;
// the shared look (fonts, tokens, nav, buttons) is copied from
// landing/index.html so both stay in step. Output is committed (the
// landing Vercel project has no build step) and CI fails when it is
// stale. Re-run after ANY guide or landing CSS change:
//   node scripts/generate-guides.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { GUIDES, HUB, UI } from './guides/content.mjs';

const SITE = 'https://www.meppletime.today';
const LANDING_UPDATED = '2026-11-17';
const LANGS = ['en', 'pl'];

const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'],
  pl: ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca',
    'sierpnia', 'września', 'października', 'listopada', 'grudnia']
};
const formatDate = (iso, lang) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[lang][m - 1]} ${y}`;
};

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripTags = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const minutesToRead = (html) => Math.max(2, Math.round(stripTags(html).split(' ').length / 200));

// Paths and URLs
const homePath = (lang) => (lang === 'en' ? '/' : '/pl/');
const hubPath = (lang) => `${homePath(lang)}${HUB[lang].slug}/`;
const guidePath = (guide, lang) => `${hubPath(lang)}${guide[lang].slug}/`;
const appUrl = (lang) => `https://app.meppletime.today/?lang=${lang}`;
const privacyUrl = (lang) => `https://app.meppletime.today/privacy?lang=${lang}`;
const abs = (path) => SITE + path;

// Shared CSS: everything in the landing stylesheet before the hero
// rules (self-hosted fonts, tokens, base, kicker, nav, language
// toggle, buttons). Guide-specific rules follow.
const landingHtml = readFileSync('landing/index.html', 'utf8');
const styleStart = landingHtml.indexOf('<style>') + '<style>'.length;
const heroAt = landingHtml.indexOf('/* Hero */', styleStart);
if (styleStart < 7 || heroAt < 0) throw new Error('landing/index.html: shared CSS markers not found');
const SHARED_CSS = landingHtml.slice(styleStart, heroAt).trimEnd();

const GUIDE_CSS = `
    /* Guide pages (feature 24) */
    .nav-link { font: 600 15px var(--font-body); color: var(--ink); text-decoration: none; padding: 8px 4px; }
    .nav-link:hover { color: var(--terra-700); }
    .lang a { display: inline-block; background: var(--surface); color: var(--neutral-700); font: 600 13px var(--font-body); padding: 6px 12px; text-decoration: none; }
    .lang a[aria-current="page"] { background: var(--terra-700); color: var(--ground); }
    main { padding: 24px 0 8px; }
    .layout { display: grid; grid-template-columns: minmax(0, 720px) 230px; justify-content: space-between; gap: 56px; align-items: start; }
    .toc { position: sticky; top: 104px; margin-top: 210px; font-size: 14.5px; }
    .toc-label { font: 700 13px var(--font-body); letter-spacing: 0.14em; text-transform: uppercase; color: var(--neutral-700); margin: 0 0 10px; }
    .toc ol { list-style: none; margin: 0; padding: 0 0 0 14px; border-left: 2px solid rgb(32 30 29 / 0.12); }
    .toc li { margin: 0 0 9px; line-height: 1.35; }
    .toc a { color: var(--neutral-700); text-decoration: none; }
    .toc a:hover { color: var(--terra-700); text-decoration: underline; }
    .article h2[id] { scroll-margin-top: 104px; }
    .article { max-width: 720px; }
    .hub-intro { max-width: 56ch; }
    .crumbs { font-size: 14px; color: var(--neutral-700); margin: 0 0 22px; }
    .crumbs a { color: var(--neutral-700); }
    .crumbs span[aria-hidden] { margin: 0 6px; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    h1.page-title { font-size: clamp(34px, 5.4vw, 52px); margin-bottom: 14px; }
    .meta { font-size: 14.5px; color: var(--neutral-700); margin: 0 0 28px; }
    .tldr { background: var(--sage-200); border-radius: var(--radius-sm); padding: 20px 24px; margin: 0 0 36px; }
    .tldr-label { font: 700 13px var(--font-body); letter-spacing: 0.14em; text-transform: uppercase; color: var(--sage-800); margin: 0 0 6px; }
    .tldr p:last-child { margin: 0; font-size: 18px; color: var(--sage-900); }
    .article h2 { font-size: clamp(24px, 3.2vw, 30px); margin: 40px 0 12px; }
    .article h3 { font-size: 20px; margin: 26px 0 8px; }
    .article p, .article li { color: #3b3631; }
    .article p { margin: 0 0 16px; }
    .article ul, .article ol { margin: 0 0 18px; padding-left: 22px; }
    .article li { margin-bottom: 8px; }
    .article li::marker { color: var(--terra-700); font-weight: 700; }
    .tip { background: var(--surface); border-radius: var(--radius-sm); padding: 18px 22px; margin: 22px 0; }
    .tip p { margin: 0; }
    .table-scroll { overflow-x: auto; margin: 8px 0 12px; border-radius: var(--radius-sm); background: var(--surface); }
    table.compare { border-collapse: collapse; width: 100%; min-width: 660px; font-size: 15px; }
    .compare th, .compare td { text-align: left; vertical-align: top; padding: 11px 12px; border-bottom: 1px solid rgb(32 30 29 / 0.12); }
    .compare thead th { font: 700 15px var(--font-heading); background: var(--ground); }
    .compare thead th.us { background: var(--terra-700); color: var(--ground); }
    .compare tbody th { font-weight: 600; color: var(--ink); }
    .compare td.us { background: var(--terra-100); font-weight: 600; }
    .compare tr:last-child th, .compare tr:last-child td { border-bottom: 0; }
    .compare tbody th, .compare thead th:first-child { position: sticky; left: 0; z-index: 1; min-width: 118px; }
    .compare tbody th { background: var(--surface); box-shadow: 1px 0 0 rgb(32 30 29 / 0.12); }
    .compare thead th:first-child { background: var(--ground); }
    .swipe-hint { display: none; font-size: 14px; color: var(--neutral-700); margin: 0 0 6px; }
    .checked { font-size: 14px; color: var(--neutral-700); }
    .sources { font-size: 14.5px; }
    .sources li { overflow-wrap: anywhere; }
    .band { background: var(--sage-700); color: var(--sage-100); border-radius: var(--radius); padding: 40px; margin: 48px 0 40px; }
    .band h2 { font-size: clamp(26px, 3.6vw, 34px); color: #fff; margin: 0 0 10px; }
    .band p { font-size: 18px; max-width: 56ch; margin: 0 0 22px; color: var(--sage-100); }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; margin: 0 0 24px; }
    .card { display: block; background: var(--surface); border-radius: var(--radius); padding: 22px 24px; text-decoration: none; color: var(--ink); transition: transform 0.2s; }
    .card:hover { transform: translateY(-3px); }
    .card h3 { font-size: 19px; margin: 0 0 6px; color: var(--ink); }
    .card p { margin: 0; font-size: 15px; color: var(--neutral-700); }
    .card .more { display: inline-block; margin-top: 10px; font-weight: 600; color: var(--terra-700); }
    .related h2 { font-size: 24px; margin: 0 0 16px; }
    .hub-intro { font-size: 19px; color: var(--neutral-700); max-width: 56ch; margin: 0 0 32px; }
    footer { border-top: 1px solid rgb(32 30 29 / 0.16); padding: 28px 0 48px; margin-top: 40px; display: flex; flex-wrap: wrap; align-items: center; gap: 14px; color: var(--neutral-700); font-size: 14px; }
    footer .brand-word { font-size: 24px; }
    footer .foot-spacer { margin-left: auto; }
    footer a { color: var(--neutral-700); }
    @media (max-width: 1020px) {
      .layout { display: block; }
      .toc { display: none; }
    }
    @media (max-width: 820px) {
      .band { padding: 30px 22px; }
      .tldr { padding: 18px 20px; }
    }
    @media (max-width: 640px) {
      .swipe-hint { display: block; }
      footer .foot-spacer { flex-basis: 100%; height: 0; margin: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .card, .btn { transition: none; }
    }`;

const FONT_PRELOADS = [
  'baloo-2-latin-700-normal.woff2',
  'figtree-latin-400-normal.woff2',
  'caprasimo-latin-400-normal.woff2'
].map((f) => `  <link rel="preload" as="font" type="font/woff2" href="/assets/fonts/${f}" crossorigin />`).join('\n');

// Vercel Web Analytics (feature 25), same snippet as landing/index.html
const ANALYTICS = `  <script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
  <script defer src="/_vercel/insights/script.js"></script>
`;

const jsonLd = (data) =>
  `  <script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n  </script>`;

const PUBLISHER = {
  '@type': 'Organization',
  '@id': `${SITE}/#organization`,
  name: 'MeppleTime',
  url: `${SITE}/`,
  logo: { '@type': 'ImageObject', url: `${SITE}/apple-touch-icon.png`, width: 180, height: 180 },
  sameAs: ['https://github.com/Halfhide/boardlabs-scheduler']
};

function head({ lang, title, description, path, altPaths, ogType, ld, extraMeta = '', robots = '' }) {
  const ui = UI[lang];
  const alternates = altPaths
    ? [
      `  <link rel="alternate" hreflang="en" href="${abs(altPaths.en)}" />`,
      `  <link rel="alternate" hreflang="pl" href="${abs(altPaths.pl)}" />`,
      `  <link rel="alternate" hreflang="x-default" href="${abs(altPaths.en)}" />`
    ].join('\n')
    : '';
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <script>
    // Arriving from the language toggle: regrow from where it was clicked
    try {
      var regrow = sessionStorage.getItem('mtRegrow');
      if (regrow) {
        sessionStorage.removeItem('mtRegrow');
        var at = JSON.parse(regrow);
        document.documentElement.style.setProperty('--vt-x', at.x + '%');
        document.documentElement.style.setProperty('--vt-y', at.y + '%');
      }
    } catch (e) { /* fine */ }
  </script>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
${robots ? `  <meta name="robots" content="${robots}" />\n` : ''}${path ? `  <link rel="canonical" href="${abs(path)}" />\n` : ''}${alternates ? alternates + '\n' : ''}  <meta property="og:site_name" content="MeppleTime" />
  <meta property="og:type" content="${ogType}" />
${path ? `  <meta property="og:url" content="${abs(path)}" />\n` : ''}  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image" content="${SITE}/assets/og-card.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="${ui.ogLocale}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${SITE}/assets/og-card.png" />
${extraMeta}${ld ? ld + '\n' : ''}${ANALYTICS}  <meta name="theme-color" content="#c67139" />
  <link rel="icon" type="image/svg+xml" href="/assets/mepple-mark.svg" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
${FONT_PRELOADS}
  <style>
${SHARED_CSS}
${GUIDE_CSS}
  </style>
</head>`;
}

function nav(lang, altPaths) {
  const ui = UI[lang];
  const langLink = (l) => {
    const href = altPaths ? altPaths[l] : homePath(l);
    const current = l === lang ? ' aria-current="page"' : '';
    return `<a href="${href}" hreflang="${l}" lang="${l}" data-lang="${l}"${current}>${l.toUpperCase()}</a>`;
  };
  return `    <nav>
      <a class="brand" href="${homePath(lang)}" aria-label="MeppleTime">
        <img src="/assets/mepple-mark.svg" alt="" aria-hidden="true" width="349" height="369" style="height:40px;width:auto" />
        <span class="brand-word"><span class="m">Mepple</span><span class="t">Time</span></span>
      </a>
      <a class="nav-link" href="${hubPath(lang)}">${ui.guides}</a>
      <span class="nav-spacer"></span>
      <div class="lang" role="group" aria-label="${ui.languageLabel}">
        ${langLink('en')}${langLink('pl')}
      </div>
      <a class="btn btn-primary btn-small" href="${appUrl(lang)}">${ui.openApp}</a>
    </nav>`;
}

function footer(lang) {
  const ui = UI[lang];
  return `    <footer>
      <img src="/assets/mepple-mark.svg" alt="" aria-hidden="true" width="349" height="369" loading="lazy" style="height:22px;width:auto" />
      <span class="brand-word"><span class="m">Mepple</span><span class="t">Time</span></span>
      <span>${ui.footNote}</span>
      <span class="foot-spacer"></span>
      <a href="${hubPath(lang)}">${ui.guides}</a>
      <a href="${privacyUrl(lang)}">${ui.privacy}</a>
      <a href="https://github.com/Halfhide/boardlabs-scheduler">${ui.sourceCode}</a>
      <a href="${appUrl(lang)}">${ui.openApp}</a>
    </footer>`;
}

// Remembers the language picked in the toggle, like the landing does,
// so the next visit to / routes straight to the chosen language.
const LANG_SCRIPT = `  <script>
    // The nav floats as a frosted island once the page scrolls (shared
    // landing CSS, feature 27)
    (function () {
      var nav = document.querySelector('nav');
      var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 12); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    })();
    document.querySelectorAll('.lang a').forEach(function (a) {
      a.addEventListener('click', function () {
        try {
          localStorage.setItem('landingLang', a.getAttribute('data-lang'));
          var r = a.getBoundingClientRect();
          sessionStorage.setItem('mtRegrow', JSON.stringify({
            x: Math.round(((r.left + r.width / 2) / window.innerWidth) * 100),
            y: Math.round(((r.top + r.height / 2) / window.innerHeight) * 100)
          }));
        } catch (e) { /* fine */ }
      });
    });
  </script>`;

function band(lang) {
  const ui = UI[lang];
  return `      <section class="band">
        <h2>${ui.bandTitle}</h2>
        <p>${ui.bandBody}</p>
        <a class="btn btn-cream" href="${appUrl(lang)}">${ui.bandCta}</a>
      </section>`;
}

function card(guide, lang) {
  const g = guide[lang];
  return `        <a class="card" href="${guidePath(guide, lang)}">
          <h3>${g.cardTitle}</h3>
          <p>${g.cardBody}</p>
          <span class="more">${UI[lang].readGuide}</span>
        </a>`;
}

function crumbs(lang, items) {
  const ui = UI[lang];
  const all = [{ name: 'MeppleTime', path: homePath(lang) }, ...items];
  const html = all.map((c, i) => (i < all.length - 1
    ? `<a href="${c.path}">${esc(c.name)}</a>`
    : `<span aria-current="page">${esc(c.name)}</span>`)).join('<span aria-hidden="true">/</span>');
  const ld = {
    '@type': 'BreadcrumbList',
    itemListElement: all.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(c.path) }))
  };
  return { html: `      <div class="crumbs" role="navigation" aria-label="${ui.breadcrumbLabel}">${html}</div>`, ld };
}

// {{guide:<id>}} in a body becomes that guide's path in the same language
const linkGuides = (body, lang) => body.replace(/\{\{guide:(\w+)\}\}/g, (_, id) => {
  const target = GUIDES.find((g) => g.id === id);
  if (!target) throw new Error(`Unknown guide link: ${id}`);
  return guidePath(target, lang);
});

// Gives every h2 in a body a stable id (ASCII slug of its text,
// without the step number) and returns the body plus a contents list
const slugify = (text) => text.toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l')
  .replace(/^\d+\.\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function withAnchors(body) {
  const toc = [];
  const out = body.replace(/<h2>(.*?)<\/h2>/g, (_, inner) => {
    const id = slugify(stripTags(inner));
    if (toc.some((t) => t.id === id)) throw new Error(`Duplicate heading id: ${id}`);
    toc.push({ id, text: stripTags(inner) });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { body: out, toc };
}

function guidePage(guide, lang) {
  const g = guide[lang];
  const ui = UI[lang];
  const path = guidePath(guide, lang);
  const altPaths = { en: guidePath(guide, 'en'), pl: guidePath(guide, 'pl') };
  const crumb = crumbs(lang, [{ name: ui.guides, path: hubPath(lang) }, { name: g.cardTitle, path }]);
  const related = GUIDES.filter((x) => x.id !== guide.id);
  const { body, toc } = withAnchors(linkGuides(g.body, lang));
  const ld = jsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${abs(path)}#article`,
        headline: g.h1,
        description: g.description,
        inLanguage: lang,
        datePublished: guide.published,
        dateModified: guide.updated,
        mainEntityOfPage: abs(path),
        image: `${SITE}/assets/og-card.png`,
        author: { '@id': `${SITE}/#organization` },
        publisher: { '@id': `${SITE}/#organization` },
        about: g.about.map((name) => ({ '@type': 'Thing', name }))
      },
      crumb.ld,
      PUBLISHER
    ]
  });
  const extraMeta = `  <meta property="article:published_time" content="${guide.published}" />
  <meta property="article:modified_time" content="${guide.updated}" />
`;
  return `${head({ lang, title: g.title, description: g.description, path, altPaths, ogType: 'article', ld, extraMeta })}
<body>
  <div class="wrap">
${nav(lang, altPaths)}
    <main>
      <div class="layout">
      <article class="article">
${crumb.html}
        <p class="kicker">${ui.guide}</p>
        <h1 class="page-title">${g.h1}</h1>
        <p class="meta">${ui.updated} <time datetime="${guide.updated}">${formatDate(guide.updated, lang)}</time> · ${minutesToRead(g.body)} ${ui.minRead}</p>
        <div class="tldr">
          <p class="tldr-label">${ui.inShort}</p>
          <p>${g.lead}</p>
        </div>
${body.trim().split('\n').map((l) => (l ? '        ' + l.trim() : '')).join('\n')}
      </article>
      <aside class="toc" aria-label="${ui.onThisPage}">
        <p class="toc-label">${ui.onThisPage}</p>
        <ol>
${toc.map((t) => `          <li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('\n')}
        </ol>
      </aside>
      </div>
${band(lang)}
      <section class="related">
        <h2>${ui.moreGuides}</h2>
        <div class="cards">
${related.map((r) => card(r, lang)).join('\n')}
        </div>
      </section>
    </main>
${footer(lang)}
  </div>
${LANG_SCRIPT}
</body>
</html>
`;
}

function hubPage(lang) {
  const h = HUB[lang];
  const ui = UI[lang];
  const path = hubPath(lang);
  const altPaths = { en: hubPath('en'), pl: hubPath('pl') };
  const crumb = crumbs(lang, [{ name: ui.guides, path }]);
  const ld = jsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${abs(path)}#page`,
        name: h.h1,
        description: h.description,
        inLanguage: lang,
        url: abs(path),
        publisher: { '@id': `${SITE}/#organization` },
        hasPart: GUIDES.map((guide) => ({ '@type': 'Article', headline: guide[lang].h1, url: abs(guidePath(guide, lang)) }))
      },
      crumb.ld,
      PUBLISHER
    ]
  });
  return `${head({ lang, title: h.title, description: h.description, path, altPaths, ogType: 'website', ld })}
<body>
  <div class="wrap">
${nav(lang, altPaths)}
    <main class="hub">
${crumb.html}
      <p class="kicker">${ui.guides}</p>
      <h1 class="page-title">${h.h1}</h1>
      <p class="hub-intro">${h.intro}</p>
      <div class="cards">
${GUIDES.map((guide) => card(guide, lang)).join('\n')}
      </div>
${band(lang)}
    </main>
${footer(lang)}
  </div>
${LANG_SCRIPT}
</body>
</html>
`;
}

// Branded 404, bilingual on one page (Vercel serves /404.html for any
// unknown path, whatever its language)
function notFoundPage() {
  const en = UI.en;
  const pl = UI.pl;
  return `${head({ lang: 'en', title: `${en.notFoundTitle} | MeppleTime`, description: en.notFoundBody, ogType: 'website', robots: 'noindex' })}
<body>
  <div class="wrap">
${nav('en', null)}
    <main class="hub">
      <p class="kicker">404</p>
      <h1 class="page-title">${en.notFoundTitle}</h1>
      <p class="hub-intro">${en.notFoundBody}</p>
      <div lang="pl">
        <h2 class="page-title" style="font-size:clamp(26px,3.6vw,34px)">${pl.notFoundTitle}</h2>
        <p class="hub-intro">${pl.notFoundBody}</p>
      </div>
      <div class="cards">
        <a class="card" href="/"><h3>${en.notFoundHome}</h3><p>www.meppletime.today</p></a>
        <a class="card" href="/pl/" lang="pl"><h3>${pl.notFoundHome}</h3><p>www.meppletime.today/pl/</p></a>
        <a class="card" href="${appUrl('en')}"><h3>${en.openApp}</h3><p>app.meppletime.today</p></a>
      </div>
    </main>
${footer('en')}
  </div>
${LANG_SCRIPT}
</body>
</html>
`;
}

function sitemap() {
  const entry = (paths, lastmod) => LANGS.map((lang) => `  <url>
    <loc>${abs(paths[lang])}</loc>
    <lastmod>${lastmod}</lastmod>
    <xhtml:link rel="alternate" hreflang="en" href="${abs(paths.en)}" />
    <xhtml:link rel="alternate" hreflang="pl" href="${abs(paths.pl)}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(paths.en)}" />
  </url>`).join('\n');
  const newest = GUIDES.map((g) => g.updated).sort().at(-1);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entry({ en: homePath('en'), pl: homePath('pl') }, LANDING_UPDATED)}
${entry({ en: hubPath('en'), pl: hubPath('pl') }, newest)}
${GUIDES.map((g) => entry({ en: guidePath(g, 'en'), pl: guidePath(g, 'pl') }, g.updated)).join('\n')}
</urlset>
`;
}

// llms.txt (llmstxt.org): a plain summary for AI assistants and the
// crawlers behind them, with links to every public page
function llmsTxt() {
  const list = (lang) => GUIDES.map((g) => `- [${g[lang].h1}](${abs(guidePath(g, lang))}): ${g[lang].description}`).join('\n');
  return `# MeppleTime

> MeppleTime is a free web app for scheduling board game nights. The organizer proposes possible dates and shares one link; friends vote yes, maybe or no on each date without creating an account, and the group can also suggest board games (with BoardGameGeek search) and vote on what to play. It is available in English and Polish.

Key facts:

- Free, with no ads and no paid tier. The app has no analytics or tracking scripts; this website counts page views anonymously with Vercel Web Analytics. An independent, open-source side project (GPL-3).
- Works in any browser on phones and computers and can be installed to the home screen. There is nothing to download from an app store.
- Voters only type a name. Creating a poll needs no account either; signing in (Google or an emailed link) is optional and keeps your polls on every device.
- Features: yes/maybe/no voting on dates, a group availability heatmap, a Doodle-style table of everyone's answers, optional voting deadline, minimum and maximum player counts, game suggestions and voting with BoardGameGeek search, locking the final date, comments.
- Polls propose whole days, not time slots. They are deleted automatically about a year after their last proposed date.
- Made for board game groups, but it works for any small group picking a date.

## Main pages

- [MeppleTime (English)](${SITE}/): what it is, how it works, FAQ
- [MeppleTime (Polski)](${SITE}/pl/): the same page in Polish
- [Open the app](https://app.meppletime.today/): create a poll

## Guides (English)

${list('en')}

## Poradniki (Polski)

${list('pl')}

## Optional

- [Privacy](https://app.meppletime.today/privacy): what is stored, where, and for how long
- [Source code](https://github.com/Halfhide/boardlabs-scheduler): the full app, GPL-3
`;
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(path, content.length, 'bytes');
}

for (const lang of LANGS) {
  write(`landing${hubPath(lang)}index.html`, hubPage(lang));
  for (const guide of GUIDES) write(`landing${guidePath(guide, lang)}index.html`, guidePage(guide, lang));
}
write('landing/404.html', notFoundPage());
write('landing/sitemap.xml', sitemap());
write('landing/llms.txt', llmsTxt());
