import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
const out = 'tests/results/quality';
const data = JSON.parse(await readFile(`${out}/screen-check.json`, 'utf8'));
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const find = (label, width) => data.shots.find(s => s.label === label && s.width === width);
const figure = (s, caption, detail = false) => {
  const file = basename(detail && s.detailFile ? s.detailFile : s.file);
  return `<figure><figcaption>${esc(caption)}</figcaption><a href="${file}"><img loading="lazy" src="${file}" alt="${esc(caption)}"></a></figure>`;
};
const sections = [];
for (const lang of ['pl', 'en']) {
  for (const [state, title] of [['recovery-empty','Ponowne logowanie'],['recovery-sent','Wysłany link'],['recovery-rejected','Odrzucone konto'],['recovery-restored','Odtworzona sesja']]) {
    sections.push(`<details><summary>${title}, ${lang.toUpperCase()}</summary><div class="pair">${figure(find(`${state}-${lang}`,390),'Telefon 390 px',true)}${figure(find(`${state}-${lang}`,1440),'Desktop 1440 px',true)}</div></details>`);
  }
}
for (const lang of ['pl', 'en']) {
  for (const width of [390,1440]) for (const [state,title] of [['home','Strona główna'],['privacy','Prywatność']]) {
    sections.push(`<details><summary>${title}, ${lang.toUpperCase()}, ${width} px: wzorzec i zintegrowana aplikacja</summary><div class="pair">${figure(find(`reference-${state}-${lang}`,width),'Publiczny MeppleTime')}${figure(find(`${state}-${lang}`,width),'Zintegrowana aplikacja lokalna')}</div></details>`);
  }
  for (const state of ['signin','poll-empty','poll-long','transfer','transfer-error','signed-in','legacy-unclaimed','legacy-owned','history','history-error']) {
    sections.push(`<details><summary>${state}, ${lang.toUpperCase()}</summary><div class="pair">${figure(find(`${state}-${lang}`,390),'Telefon 390 px')}${figure(find(`${state}-${lang}`,1440),'Desktop 1440 px')}</div></details>`);
  }
}
await writeFile(`${out}/review-gallery.html`, `<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MeppleTime: odzyskiwanie sesji</title><style>body{font:16px/1.5 system-ui,sans-serif;background:#f5ead8;color:#25221e;margin:20px;max-width:1500px}h1{line-height:1.2}p{max-width:950px}details{border-top:1px solid #b5aa97;padding:12px 0}summary{cursor:pointer;font-weight:650}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}figure{margin:12px 0}figcaption{margin-bottom:8px;font-weight:600}img{width:100%;height:auto;border:1px solid #c8bda9;box-sizing:border-box}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style><h1>MeppleTime: integracja bezpieczeństwa i transferu kont</h1><p>7 października 2026. Przegląd zintegrowanej aplikacji uruchomionej lokalnie w PL i EN. Dane ankiet i kont są fikcyjne. Publiczna aplikacja służyła jako wzorzec odczytany bez logowania i zapisów danych. To materiał do oceny zmian, nie wdrożona wersja.</p><p>Panel pozwala wrócić do pierwotnego konta przez Google lub link e-mail. Wybranie innego konta nie zmienia celu transferu. Kliknij obraz, aby obejrzeć pełny rozmiar. Pełne ekrany są zapisane obok tej galerii; widoki odzyskiwania poniżej pokazują sam panel.</p>${sections.join('\n')}</html>`);
console.log('Gallery written:', sections.length, 'comparisons');
