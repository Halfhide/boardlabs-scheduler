import { adminAuth, adminDb } from './admin.mjs';

// Timestamp tags avoid confusing user-authored objects with serialized dates.
export function serialize(value) {
  if (value?.toMillis instanceof Function) return { _timestamp: value.toMillis() };
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  return value;
}
export async function trustedRead(token, request) {
  if (!request || Array.isArray(request) || Object.keys(request).some(k => !['action', 'pollId'].includes(k))) throw new Error('invalid-fields');
  if (request.action === 'poll') {
    if (typeof request.pollId !== 'string' || !/^v2_[A-Za-z0-9_-]{1,61}$/.test(request.pollId)) throw new Error('invalid-id');
    const snapshot = await adminDb.doc(`pollsV2/${request.pollId}`).get();
    return { poll: snapshot.exists ? serialize(snapshot.data()) : null };
  }
  if (request.action !== 'history' || request.pollId !== undefined || !token) throw new Error('invalid-action');
  const { uid } = await adminAuth.verifyIdToken(token, true);
  // The UI shows recent history, migration discovery independently pages all rows.
  const rows = await adminDb.collection(`usersV2/${uid}/history`).orderBy('lastSeen', 'desc').limit(50).get();
  return { polls: Object.fromEntries(rows.docs.map(row => {
    const value = row.data();
    return [row.id, { id: row.id, title: value.title, createdByMe: !!value.createdByMe, lastSeen: value.lastSeen?.toMillis() ?? 0 }];
  })) };
}
