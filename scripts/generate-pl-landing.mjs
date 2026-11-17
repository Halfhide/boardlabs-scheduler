// Generates landing/pl/index.html, the static Polish landing page,
// from landing/index.html (feature 20). The EN file stays the single
// source of truth: this script loads it headlessly, applies the
// Polish dictionary via the page's own setLang('pl'), localizes the
// head (canonical, hreflang stays, OG/Twitter, JSON-LD), and
// serializes the result. Re-run after ANY landing copy change:
//   node scripts/generate-pl-landing.mjs
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

mkdirSync('landing/pl', { recursive: true });

const browser = await puppeteer.launch({
  executablePath:
    process.env.CHROME_PATH ||
    process.env.CHROME_BIN ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new'
});
const page = await browser.newPage();
await page.goto('file://' + resolve('landing/index.html'), { waitUntil: 'domcontentloaded' });

const html = await page.evaluate(() => {
  // The EN page's static JSON-LD must match its dictionary (crawlers
  // that skip JavaScript read the JSON-LD, so it cannot be built at
  // runtime). Fail loudly when they drift apart.
  const en = STRINGS.en;
  const enText = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent; };
  const enBlocks = document.head.querySelectorAll('script[type="application/ld+json"]');
  const enApp = JSON.parse(enBlocks[0].textContent)['@graph'].find((n) => n['@type'] === 'WebApplication');
  const enFaq = JSON.parse(enBlocks[1].textContent).mainEntity;
  const enFaqKeys = Object.keys(en).filter((k) => /^faq\d+q$/.test(k));
  const problems = [];
  if (JSON.stringify(enApp.featureList) !== JSON.stringify(en.schemaFeatures)) problems.push('featureList != STRINGS.en.schemaFeatures');
  if (enApp.description !== en.docDesc) problems.push('WebApplication description != STRINGS.en.docDesc');
  if (enFaq.length !== enFaqKeys.length) problems.push('FAQPage has ' + enFaq.length + ' questions, STRINGS.en has ' + enFaqKeys.length);
  enFaqKeys.forEach((q, i) => {
    const item = enFaq[i] || {};
    if (item.name !== en[q]) problems.push('FAQPage question ' + (i + 1) + ' differs from STRINGS.en.' + q);
    if ((item.acceptedAnswer || {}).text !== enText(en[q.replace(/q$/, 'a')])) problems.push('FAQPage answer ' + (i + 1) + ' differs from STRINGS.en');
  });
  if (Object.keys(STRINGS.pl).filter((k) => /^faq\d+q$/.test(k)).length !== enFaqKeys.length) problems.push('STRINGS.pl has a different number of FAQ questions');
  if (problems.length) return { problems };

  setLang('pl');
  const pl = STRINGS.pl;

  // The page ran its motion script while loading here: strip the state
  // it left behind so the Polish file starts clean like the English one
  // (feature 27)
  document.documentElement.classList.remove('js', 'regrow');
  document.documentElement.style.removeProperty('--vt-x');
  document.documentElement.style.removeProperty('--vt-y');
  if (!document.documentElement.getAttribute('style')) document.documentElement.removeAttribute('style');
  if (!document.documentElement.getAttribute('class')) document.documentElement.removeAttribute('class');
  document.querySelectorAll('.is-in, .scrolled').forEach((el) => el.classList.remove('is-in', 'scrolled'));

  const setAttr = (sel, attr, value) => {
    const el = document.head.querySelector(sel);
    if (el) el.setAttribute(attr, value);
  };
  setAttr('link[rel="canonical"]', 'href', 'https://www.meppletime.today/pl/');
  setAttr('meta[property="og:url"]', 'content', 'https://www.meppletime.today/pl/');
  setAttr('meta[property="og:locale"]', 'content', 'pl_PL');
  setAttr('meta[property="og:locale:alternate"]', 'content', 'en_US');
  setAttr('meta[property="og:title"]', 'content', pl.docTitle);
  setAttr('meta[property="og:description"]', 'content', pl.docDesc);
  setAttr('meta[name="twitter:title"]', 'content', pl.docTitle);
  setAttr('meta[name="twitter:description"]', 'content', pl.docDesc);

  // Language handoff: app-bound links carry the page's language so
  // the app (a separate origin with its own storage) opens in it
  document.querySelectorAll('a[href*="app.meppletime.today"]').forEach((a) => {
    a.setAttribute('href', a.getAttribute('href').replace('lang=en', 'lang=pl'));
  });

  // JSON-LD: block 0 is the site graph (WebSite, Organization,
  // WebApplication), block 1 the FAQPage. FAQ answers may carry
  // links in the page; structured data gets their plain text.
  const plain = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent; };
  const faqKeys = Object.keys(pl).filter((k) => /^faq\d+q$/.test(k));
  const ldBlocks = document.head.querySelectorAll('script[type="application/ld+json"]');
  const graph = JSON.parse(ldBlocks[0].textContent);
  const app = graph['@graph'].find((node) => node['@type'] === 'WebApplication');
  app.url = 'https://www.meppletime.today/pl/';
  app.inLanguage = ['pl', 'en'];
  app.description = pl.docDesc;
  app.featureList = pl.schemaFeatures;
  app.offers.priceCurrency = 'PLN';
  ldBlocks[0].textContent = '\n' + JSON.stringify(graph, null, 2) + '\n  ';
  ldBlocks[1].textContent = '\n' + JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqKeys.map((q) => ({
      '@type': 'Question',
      name: pl[q],
      acceptedAnswer: { '@type': 'Answer', text: plain(pl[q.replace(/q$/, 'a')]) }
    }))
  }, null, 2) + '\n  ';

  return '<!doctype html>\n' + document.documentElement.outerHTML;
});

if (html.problems) {
  await browser.close();
  console.error('landing/index.html is inconsistent:\n- ' + html.problems.join('\n- '));
  process.exit(1);
}
writeFileSync('landing/pl/index.html', html);
console.log('landing/pl/index.html', html.length, 'bytes');
await browser.close();
