// Per-browser list of polls the user created or visited, kept in
// localStorage so people stop losing poll links.

const KEY = 'myPolls';
const MAX_ENTRIES = 50;

/**
 * Read the remembered polls, newest first.
 * @returns {Array<{id: string, title: string, createdByMe: boolean, lastSeen: number}>}
 */
export function getMyPolls() {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (error) {
    console.error('Error reading my polls:', error);
    return [];
  }
}

function save(list) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch (error) {
    console.error('Error saving my polls:', error);
  }
}

/**
 * Remember a poll (or bump it to the top with a fresh timestamp and
 * title). The createdByMe flag is sticky once set.
 */
export function rememberPoll({ id, title, createdByMe = false }) {
  if (!id || !title) return;

  const list = getMyPolls();
  const existing = list.find((p) => p.id === id);

  const entry = {
    id,
    title,
    createdByMe: createdByMe || existing?.createdByMe || false,
    lastSeen: Date.now()
  };

  save([entry, ...list.filter((p) => p.id !== id)].slice(0, MAX_ENTRIES));
}

/**
 * Remove a poll from the remembered list.
 */
export function forgetPoll(id) {
  save(getMyPolls().filter((p) => p.id !== id));
}
