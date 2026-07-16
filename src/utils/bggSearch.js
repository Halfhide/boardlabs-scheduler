// Client for the BGG search proxy (api/bgg-search.js)

export async function searchBggGames(query, signal) {
  const res = await fetch(
    `/api/bgg-search?query=${encodeURIComponent(query)}`,
    { signal }
  );
  if (!res.ok) throw new Error(`BGG search failed (${res.status})`);
  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

export function bggGameUrl(id) {
  return `https://boardgamegeek.com/boardgame/${id}`;
}
