/* global process */
// Vercel serverless function that proxies BoardGameGeek XML API2 search.
// BGG sends no CORS headers, so the browser cannot call it directly.
// Returns trimmed JSON: { results: [{ id, name, year }] }.
//
// Since July 2025 BGG requires a registered application and a Bearer
// token (https://boardgamegeek.com/using_the_xml_api). Set BGG_API_TOKEN
// in the environment (Vercel project settings; .env locally). Without a
// token BGG answers 401 and the client falls back to free-text entry.
//
// This same handler is mounted on the Vite dev server by vite.config.js,
// so it only relies on (req, res) fields both environments provide.

const BGG_SEARCH_URL = 'https://boardgamegeek.com/xmlapi2/search';
const MAX_RESULTS = 10;

function decodeXmlEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseSearchXml(xml) {
  const results = [];
  const seenIds = new Set();
  const itemRegex = /<item\b[^>]*\bid="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const [, id, body] = match;
    if (seenIds.has(id)) continue;
    // The first <name> element is the one BGG matched (primary when available)
    const name = body.match(/<name\b[^>]*\bvalue="([^"]*)"/);
    if (!name) continue;
    const year = body.match(/<yearpublished\b[^>]*\bvalue="(-?\d+)"/);
    seenIds.add(id);
    results.push({
      id,
      name: decodeXmlEntities(name[1]),
      year: year ? Number(year[1]) : null,
    });
  }
  return results;
}

// BGG returns items in id order (oldest first), not by relevance;
// surface exact and prefix matches before the rest.
function rankResults(results, query) {
  const q = query.toLowerCase();
  const score = (r) => {
    const n = r.name.toLowerCase();
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    return 2;
  };
  return results
    .map((r, i) => ({ r, i, s: score(r) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map(({ r }) => r);
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const query = (url.searchParams.get('query') || '').trim();

  if (query.length < 2) {
    sendJson(res, 400, { error: 'query must be at least 2 characters' });
    return;
  }

  const bggUrl = `${BGG_SEARCH_URL}?type=boardgame&query=${encodeURIComponent(query)}`;
  const token = process.env.BGG_API_TOKEN;
  const fetchOptions = token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : {};

  try {
    let bggRes = await fetch(bggUrl, fetchOptions);
    if (bggRes.status === 202) {
      // BGG queued the request; retry once after a short wait
      await new Promise((resolve) => setTimeout(resolve, 700));
      bggRes = await fetch(bggUrl, fetchOptions);
    }
    if (!bggRes.ok) {
      sendJson(res, 502, { error: `BGG responded with ${bggRes.status}` });
      return;
    }
    const xml = await bggRes.text();
    const results = rankResults(parseSearchXml(xml), query).slice(0, MAX_RESULTS);
    // Same query repeats across users; let Vercel's edge cache absorb it
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    sendJson(res, 200, { results });
  } catch (err) {
    sendJson(res, 502, { error: err.message || 'BGG request failed' });
  }
}
