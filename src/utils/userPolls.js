import { watchTrusted } from './trustedRead';
import { trustedMode, isTrustedPoll, trustedWrite } from './trustedClient';
// Cloud copy of the my-polls list for signed-in users, stored in
// users/{uid} (one document per account, readable and writable only
// by its owner). Entries live in a `polls` map keyed by poll ID so
// per-entry upserts merge safely without transactions, even from
// two devices at once.

import { doc, onSnapshot, setDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';

// Same cap as the localStorage list in myPolls.js
const MAX_ENTRIES = 50;

function userDocRef(uid) {
  return doc(db, 'users', uid);
}

/**
 * Upsert one poll entry into the account's cloud list. createdByMe
 * is only ever written as true: merge semantics cannot express
 * "keep the old value", so leaving the field out keeps the flag
 * sticky.
 */
export async function rememberPollForUser(uid, { id, title, createdByMe = false }) {
  if (!uid || !id || !title) return;
  if (isTrustedPoll(id)) return trustedWrite(id, 'visit', {}).catch(console.error);
  try {
    await setDoc(
      userDocRef(uid),
      {
        polls: {
          [id]: {
            title,
            lastSeen: new Date(),
            ...(createdByMe ? { createdByMe: true } : {})
          }
        }
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error syncing poll to account:', error);
  }
}

/**
 * Remove a poll from the account's cloud list.
 */
export async function forgetPollForUser(uid, pollId) {
  if (!uid || !pollId) return;
  if (isTrustedPoll(pollId)) return trustedWrite(pollId, 'forget', {}).catch(console.error);
  try {
    await setDoc(
      userDocRef(uid),
      { polls: { [pollId]: deleteField() } },
      { merge: true }
    );
  } catch (error) {
    console.error('Error removing poll from account list:', error);
  }
}

/**
 * Subscribe to the account's poll list. onChange receives a map of
 * pollId to {id, title, createdByMe, lastSeen(ms)}; empty when the
 * user document does not exist yet.
 * @returns {Function} unsubscribe
 */
export function watchUserPolls(uid, onChange, onError = () => {}) {
  if (trustedMode) {
    let legacy = {}, trusted = {};
    const emit = () => onChange({ ...legacy, ...trusted });
    const stopLegacy = onSnapshot(userDocRef(uid), snap => {
      legacy = Object.fromEntries(Object.entries(snap.data()?.polls || {}).filter(([id]) => !isTrustedPoll(id)).map(([id, entry]) =>
        [id, { ...entry, id, lastSeen: entry.lastSeen?.toMillis?.() ?? 0 }]));
      emit();
    }, error => { onError(error); });
    const stopTrusted = watchTrusted({ action: 'history' }, result => { trusted = result.polls; emit(); }, onError, uid);
    return () => { stopLegacy(); stopTrusted(); };
  }
  return onSnapshot(
    userDocRef(uid),
    (snap) => {
      const polls = (snap.exists() ? snap.data().polls : null) ?? {};
      const byId = {};
      Object.entries(polls).forEach(([id, entry]) => {
        byId[id] = {
          id,
          title: entry.title ?? id,
          createdByMe: !!entry.createdByMe,
          lastSeen: entry.lastSeen?.toMillis ? entry.lastSeen.toMillis() : 0
        };
      });
      onChange(byId);
    },
    (error) => {
      console.error('Error watching account polls:', error);
      onChange({});
    }
  );
}

/**
 * One-way merge of the browser's list into the cloud list: upload
 * entries the cloud is missing (or where only the browser knows the
 * poll is mine), then trim the oldest entries over the cap. Writes
 * nothing when the cloud is already up to date.
 */
export async function syncLocalPollsUp(uid, localList, cloudById) {
  if (!uid) return;
  // Local bookmarks are not ownership evidence. Import only through the server's
  // visit operation, which derives ownership from the actual poll document.
  if (trustedMode) {
    for (const entry of localList.filter(p => isTrustedPoll(p.id)).slice(0, MAX_ENTRIES)) {
      if (!cloudById[entry.id]) {
        try { await trustedWrite(entry.id, 'visit', {}); } catch { /* Retry on a later visit. */ }
      }
    }
    localList = localList.filter(p => !isTrustedPoll(p.id));
    cloudById = Object.fromEntries(Object.entries(cloudById).filter(([id]) => !isTrustedPoll(id)));
  }

  const updates = {};
  localList.forEach((p) => {
    const cloud = cloudById[p.id];
    if (cloud && (!p.createdByMe || cloud.createdByMe)) return;
    const lastSeen = Math.max(p.lastSeen || 0, cloud?.lastSeen || 0) || Date.now();
    updates[p.id] = {
      title: cloud && cloud.lastSeen > (p.lastSeen || 0) ? cloud.title : p.title,
      lastSeen: new Date(lastSeen),
      ...((p.createdByMe || cloud?.createdByMe) ? { createdByMe: true } : {})
    };
  });

  // Trim overflow, oldest first, never trimming what we just added
  const merged = new Map();
  Object.values(cloudById).forEach((e) => merged.set(e.id, e.lastSeen));
  Object.entries(updates).forEach(([id, e]) => merged.set(id, e.lastSeen.getTime()));
  [...merged.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(MAX_ENTRIES)
    .forEach(([id]) => {
      updates[id] = deleteField();
    });

  if (Object.keys(updates).length === 0) return;

  try {
    await setDoc(userDocRef(uid), { polls: updates }, { merge: true });
  } catch (error) {
    console.error('Error merging local polls into account:', error);
  }
}
