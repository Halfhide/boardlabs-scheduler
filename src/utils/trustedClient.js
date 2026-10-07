import { signInAnonymously } from 'firebase/auth';
import { nanoid } from 'nanoid';
import { auth, apiHeaders } from '../firebase';

export const trustedMode = true;
// Legacy IDs have ten characters; do not misroute an old ID starting with v2_.
export const isTrustedPoll = id => typeof id === 'string' && /^v2_[A-Za-z0-9_-]{16}$/.test(id);
export const pollCollection = id => isTrustedPoll(id) ? 'pollsV2' : 'polls';
let guestPromise;

export async function trustedWrite(pollId, action, payload) {
  if (localStorage.getItem('meppletime-pending-transfer')) throw new Error('Finish the pending move first');
  await auth.authStateReady();
  if (!auth.currentUser) {
    guestPromise ||= signInAnonymously(auth).finally(() => { guestPromise = null; });
    await guestPromise;
  }
  const user = auth.currentUser;
  // Save the full request before sending. A lost response or page reload must
  // retry the same command, including the generated poll ID and receipt key.
  const key = `meppletime-v2-request:${JSON.stringify([user.uid, pollId, action, payload])}`;
  const saved = localStorage.getItem(key);
  const request = saved ? JSON.parse(saved) : {
    requestId: nanoid(24), pollId: pollId || `v2_${nanoid(16)}`, action, payload,
  };
  localStorage.setItem(key, JSON.stringify(request));
  try {
    const response = await fetch('/api/trusted-activity', {
      method: 'POST', headers: await apiHeaders(user),
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error('Request refused');
    const result = await response.json();
    localStorage.removeItem(key);
    window.dispatchEvent(new Event('trusted-change'));
    return result;
  } catch {
    throw Object.assign(new Error('Could not save. Please retry.'), { code: 'errTrustedWrite' });
  }
}
