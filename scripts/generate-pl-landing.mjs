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
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new'
});
const page = await browser.newPage();
await page.goto('file://' + resolve('landing/index.html'), { waitUntil: 'domcontentloaded' });

const html = await page.evaluate(() => {
  setLang('pl');
  const pl = STRINGS.pl;

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

  const ldBlocks = document.head.querySelectorAll('script[type="application/ld+json"]');
  ldBlocks[0].textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'MeppleTime',
    url: 'https://www.meppletime.today/pl/',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web',
    inLanguage: ['pl', 'en'],
    description: pl.docDesc,
    image: 'https://www.meppletime.today/assets/og-card.png',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'PLN' },
    publisher: {
      '@type': 'Organization',
      name: 'MeppleTime',
      url: 'https://www.meppletime.today/',
      logo: 'https://www.meppletime.today/assets/mepple-mark.svg'
    }
  }, null, 2);
  ldBlocks[1].textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [1, 2, 3, 4, 5, 6].map((i) => ({
      '@type': 'Question',
      name: pl['faq' + i + 'q'],
      acceptedAnswer: { '@type': 'Answer', text: pl['faq' + i + 'a'] }
    }))
  }, null, 2);

  return '<!doctype html>\n' + document.documentElement.outerHTML;
});

writeFileSync('landing/pl/index.html', html);
console.log('landing/pl/index.html', html.length, 'bytes');
await browser.close();
