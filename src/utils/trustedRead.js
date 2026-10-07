import { Timestamp } from 'firebase/firestore';
import { auth, apiHeaders } from '../firebase';

function revive(value) {
  if (value && typeof value === 'object' && Object.keys(value).length === 1 && Number.isFinite(value._timestamp)) return Timestamp.fromMillis(value._timestamp);
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, revive(v)]));
  return value;
}

// Server-only collections need no new client Firestore permissions. Refresh
// after writes and on focus; serialize reads so slow responses cannot rewind UI.
export function watchTrusted(request, onValue, onError, uid) {
  let stopped = false, timer, active = false, again = false;
  const controller = new AbortController();
  async function refresh() {
    if (stopped) return;
    if (active) { again = true; return; }
    clearTimeout(timer);
    active = true;
    try {
      await auth.authStateReady();
      const user = uid ? auth.currentUser : null;
      if (uid && user?.uid !== uid) return;
      const response = await fetch('/api/trusted-read', { method: 'POST', headers: await apiHeaders(user),
        body: JSON.stringify(request), signal: controller.signal });
      if (!response.ok) throw new Error('Read refused');
      const result = revive(await response.json());
      if (!stopped && (!uid || auth.currentUser?.uid === uid)) onValue(result);
    } catch (error) {
      if (!stopped && error.name !== 'AbortError') onError(error);
    } finally {
      active = false;
      if (!stopped) { timer = setTimeout(refresh, again ? 0 : document.hidden ? 30000 : 3000); again = false; }
    }
  }
  window.addEventListener('trusted-change', refresh);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
  void refresh();
  return () => {
    stopped = true; clearTimeout(timer); controller.abort();
    window.removeEventListener('trusted-change', refresh);
    window.removeEventListener('focus', refresh);
    document.removeEventListener('visibilitychange', refresh);
  };
}
