// Resumable migration: paged discovery and per-poll receipts bound every request.
import { randomUUID } from 'node:crypto';
import { Timestamp, FieldPath } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from './admin.mjs';

const DISCOVERY_PAGE = 200;
const BATCH_SIZE = 2;
const millis = record => record?.timestamp?.toMillis?.() ?? -Infinity;
const relabel = (record, source, target) => record.uid === source
  ? { ...record, uid: target, ...(record.voterId ? { voterId: target } : {}) } : record;

function mergeChoices(votes = [], withdrawals = [], source, target) {
  const mine = v => v.uid === source || v.uid === target;
  const candidates = [...votes.map(record => ({ record, withdrawn: false })),
    ...withdrawals.map(record => ({ record, withdrawn: true }))].filter(c => mine(c.record));
  candidates.sort((a, b) => {
    const left = millis(a.record), right = millis(b.record);
    // Missing timestamps cannot establish that a source record is newer.
    if (!Number.isFinite(left) || !Number.isFinite(right) || left === right) {
      return Number(b.record.uid === target) - Number(a.record.uid === target)
        || Number(b.withdrawn) - Number(a.withdrawn);
    }
    return right - left;
  });
  const winner = candidates[0];
  return {
    votes: [...votes.filter(v => !mine(v)), ...(winner && !winner.withdrawn ? [relabel(winner.record, source, target)] : [])],
    withdrawals: [...withdrawals.filter(v => !mine(v)), ...(winner?.withdrawn ? [relabel(winner.record, source, target)] : [])],
    conflicts: Math.max(0, candidates.length - 1),
  };
}

export function containsIdentity(poll, uid) {
  return poll.ownerUid === uid || poll.dates.some(d => [...d.votes, ...(d.withdrawals ?? []), ...d.comments].some(v => v.uid === uid))
    || poll.games.some(g => g.suggestedByUid === uid || [...g.votes, ...(g.withdrawals ?? [])].some(v => v.uid === uid));
}

export function migratePollData(poll, source, target) {
  if (poll.schemaVersion !== 2 || !source || !target || source === target) throw new Error('invalid-migration');
  let conflicts = 0;
  const result = { ...poll,
    ownerUid: poll.ownerUid === source ? target : poll.ownerUid,
    dates: poll.dates.map(date => {
      const merged = mergeChoices(date.votes, date.withdrawals, source, target);
      conflicts += merged.conflicts;
      return { ...date, votes: merged.votes, withdrawals: merged.withdrawals,
        comments: date.comments.map(c => relabel(c, source, target)) };
    }),
    games: poll.games.map(game => {
      const merged = mergeChoices(game.votes, game.withdrawals, source, target);
      conflicts += merged.conflicts;
      return { ...game, votes: merged.votes, withdrawals: merged.withdrawals,
        ...(game.suggestedByUid === source ? { suggestedByUid: target, suggestedById: target } : {}) };
    }),
  };
  return { poll: result, conflicts };
}

async function verifyPair(proof) {
  if (!proof || Object.keys(proof).some(k => !['guestToken', 'accountToken'].includes(k))) throw new Error('invalid-proof');
  const [source, target] = await Promise.all([
    adminAuth.verifyIdToken(proof.guestToken, true), adminAuth.verifyIdToken(proof.accountToken, true),
  ]);
  if (source.firebase?.sign_in_provider !== 'anonymous'
    || !['password', 'google.com'].includes(target.firebase?.sign_in_provider) || source.uid === target.uid) throw new Error('invalid-identities');
  const currentSource = await adminAuth.getUser(source.uid);
  if (currentSource.providerData.length) throw new Error('source-no-longer-guest');
  return { source: source.uid, target: target.uid };
}

async function discoverPage(jobRef, job) {
  const pollsPhase = job.state === 'discovering';
  const cursor = job.cursor || null;
  let query = (pollsPhase ? adminDb.collection(`_identityPolls/${job.source}/polls`)
    : adminDb.collection(`usersV2/${job.source}/history`)).orderBy(FieldPath.documentId()).limit(DISCOVERY_PAGE);
  if (cursor) query = query.startAfter(cursor);
  const page = await query.get();
  const ids = page.docs.map(row => row.id);
  return adminDb.runTransaction(async tx => {
    const fresh = (await tx.get(jobRef)).data();
    // Another tab may have committed this page; never rewind its cursor.
    if (fresh.state !== job.state || (fresh.cursor || null) !== cursor) return fresh;
    const refs = ids.map(id => jobRef.collection('items').doc(id));
    const rows = refs.length ? await tx.getAll(...refs) : [];
    let added = 0;
    rows.forEach((row, index) => {
      if (!row.exists) { tx.create(refs[index], { state: 'pending' }); added++; }
    });
    const end = page.size < DISCOVERY_PAGE;
    const next = { ...fresh, discovered: fresh.discovered + added,
      state: end ? (pollsPhase ? 'history' : 'running') : fresh.state,
      cursor: end ? null : page.docs.at(-1).id };
    tx.set(jobRef, next);
    return next;
  });
}
const progress = job => ({ state: job.state === 'complete' ? 'complete' : 'running',
  total: job.discovered, remaining: job.discovered - job.completed + (['discovering', 'history'].includes(job.state) ? 1 : 0) });

async function performMigration(source, target) {
  const jobRef = adminDb.doc(`_identityMigrations/${source}`);
  let job = await adminDb.runTransaction(async tx => {
    const existing = await tx.get(jobRef);
    if (existing.exists) {
      if (existing.data().target !== target) throw new Error('destination-locked');
      return existing.data();
    }
    const created = { source, target, state: 'discovering', discovered: 0, completed: 0, cursor: null, createdAt: Timestamp.now() };
    tx.create(jobRef, created);
    return created;
  });
  if (job.state === 'complete') return progress(job);
  // At most one page per collection per request. The cursor survives timeouts,
  // reloads and concurrent callers. No manifest array can hit the document limit.
  if (job.state === 'discovering') job = await discoverPage(jobRef, job);
  if (job.state === 'history') job = await discoverPage(jobRef, job);
  if (job.state !== 'running') return progress(job);
  const pending = await jobRef.collection('items').where('state', '==', 'pending').limit(job.discovered > 50 ? 20 : BATCH_SIZE).get();
  for (const item of pending.docs) {
    const pollId = item.id;
    await adminDb.runTransaction(async tx => {
      const pollRef = adminDb.doc(`pollsV2/${pollId}`);
      const receiptRef = jobRef.collection('polls').doc(pollId);
      const sourceHistory = adminDb.doc(`usersV2/${source}/history/${pollId}`);
      const targetHistory = adminDb.doc(`usersV2/${target}/history/${pollId}`);
      const [receipt, snapshot, oldHistory, newHistory, freshJob] = await Promise.all([
        tx.get(receiptRef), tx.get(pollRef), tx.get(sourceHistory), tx.get(targetHistory), tx.get(jobRef),
      ]);
      if (receipt.exists) return;
      let conflicts = 0;
      if (snapshot.exists) {
        const before = snapshot.data();
        if (before.schemaVersion !== 2) throw new Error('invalid-schema');
        const migrated = migratePollData(before, source, target);
        conflicts = migrated.conflicts;
        if (Buffer.byteLength(JSON.stringify(migrated.poll)) > 800000) throw new Error('poll-size-limit');
        tx.set(pollRef, migrated.poll);
        tx.set(adminDb.doc(`_identityPolls/${target}/polls/${pollId}`), { present: true });
        const candidates = [oldHistory.data()?.lastSeen, newHistory.data()?.lastSeen, before.createdAt].filter(Boolean);
        const lastSeen = candidates.sort((a, b) => b.toMillis() - a.toMillis())[0];
        tx.set(targetHistory, { title: before.title, lastSeen, createdByMe: migrated.poll.ownerUid === target });
      } else if (newHistory.exists) tx.delete(targetHistory);
      tx.create(receiptRef, { target, conflicts, missingPoll: !snapshot.exists, completedAt: Timestamp.now() });
      tx.update(item.ref, { state: 'complete' });
      tx.update(jobRef, { completed: freshJob.data().completed + 1 });
    });
  }
  return adminDb.runTransaction(async tx => {
    const fresh = (await tx.get(jobRef)).data();
    if (fresh.state === 'complete') return progress(fresh);
    if (fresh.completed === fresh.discovered) {
      tx.update(jobRef, { state: 'complete', completedAt: Timestamp.now() });
      fresh.state = 'complete';
    }
    return progress(fresh);
  });
}

// One short worker per source prevents two tabs contending on every poll.
// A killed function leaves only a 90-second lease, not a permanent lock.
export async function migrateTrustedIdentity(proof) {
  const { source, target } = await verifyPair(proof);
  const lockRef = adminDb.doc(`_identityMigrationLocks/${source}`);
  const jobRef = adminDb.doc(`_identityMigrations/${source}`);
  const owner = randomUUID();
  const busy = await adminDb.runTransaction(async tx => {
    const [lock, snapshot] = await Promise.all([tx.get(lockRef), tx.get(jobRef)]);
    const job = snapshot.data();
    if (job && job.target !== target) throw new Error('destination-locked');
    if (job?.state === 'complete') return progress(job);
    if (lock.exists && lock.data().until.toMillis() > Date.now()) {
      return { ...(job ? progress(job) : { state: 'running', total: 0, remaining: 1 }), retryAfterMs: 1000 };
    }
    tx.set(lockRef, { owner, until: Timestamp.fromMillis(Date.now() + 90000) });
    return null;
  });
  if (busy) return busy;
  try { return await performMigration(source, target); }
  finally {
    await adminDb.runTransaction(async tx => {
      const lock = await tx.get(lockRef);
      if (lock.data()?.owner === owner) tx.delete(lockRef);
    });
  }
}

// Return only the caller's own job. The request cannot choose a source UID.
export async function trustedMigrationStatus(token) {
  const identity = await adminAuth.verifyIdToken(token, true);
  if (identity.firebase?.sign_in_provider !== 'anonymous') throw new Error('guest-required');
  const current = await adminAuth.getUser(identity.uid);
  if (current.providerData.length) throw new Error('source-no-longer-guest');
  const snapshot = await adminDb.doc(`_identityMigrations/${identity.uid}`).get();
  if (!snapshot.exists) return { migration: null };
  const job = snapshot.data();
  return { migration: { sourceUid: identity.uid, targetUid: job.target, version: 2,
    ...(job.state === 'complete' ? { phase: 'ready' } : {}) } };
}
