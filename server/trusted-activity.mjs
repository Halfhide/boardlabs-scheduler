// Trusted writes are deliberately separate from unverified legacy poll arrays.
import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from './admin.mjs';

function exact(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(k => !keys.includes(k))) throw new Error('invalid-fields');
}
function string(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('invalid-text');
  return value.trim();
}
function id(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) throw new Error('invalid-id');
  return value;
}
const hash = v => createHash('sha256').update(v).digest('hex');
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('invalid-date');
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('invalid-date');
  return date;
}
function capacity(poll, payload) {
  for (const key of ['minPlayers', 'maxPlayers']) {
    const value = payload[key] ?? null;
    if (value !== null && (!Number.isInteger(value) || value < 1 || value > 99)) throw new Error('invalid-capacity');
    if (value === null) delete poll[key]; else poll[key] = value;
  }
  if (poll.minPlayers && poll.maxPlayers && poll.maxPlayers < poll.minPlayers) throw new Error('invalid-capacity');
}
function deadline(poll, value) {
  if (value == null) { delete poll.deadline; return; }
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('invalid-deadline');
  poll.deadline = Timestamp.fromDate(new Date(value));
}
const fields = {
  create: ['title', 'dates', 'deadline', 'minPlayers', 'maxPlayers'], vote: ['dateId', 'name', 'response', 'guests'],
  comment: ['dateId', 'name', 'text'], game: ['name', 'title', 'url'],
  gameVote: ['gameId', 'name', 'selected'], close: ['closed', 'clearDeadline'],
  finalize: ['dateId'], rename: ['title'],
  deadline: ['deadline'], capacity: ['minPlayers', 'maxPlayers'],
  addDate: ['date'], removeDate: ['dateId'], removeGame: ['gameId'], delete: [],
  visit: [], forget: [],
};

export async function trustedActivity(token, request) {
  exact(request, ['requestId', 'pollId', 'action', 'payload']);
  const { requestId, pollId, action, payload } = request;
  id(requestId); id(pollId);
  if (!/^v2_[A-Za-z0-9_-]{16}$/.test(pollId)) throw new Error('invalid-poll-id');
  if (!Object.hasOwn(fields, action)) throw new Error('invalid-action');
  exact(payload, fields[action]);
  const identity = await adminAuth.verifyIdToken(token, true);
  if (!['anonymous', 'password', 'google.com'].includes(identity.firebase?.sign_in_provider)) throw new Error('invalid-provider');
  const uid = identity.uid;
  const fingerprint = hash(JSON.stringify(canonical(request)));
  const receiptRef = adminDb.doc(`_trustedRequests/${hash(`${uid}:${requestId}`)}`);
  const pollRef = adminDb.doc(`pollsV2/${pollId}`);
  const migrationRef = adminDb.doc(`_identityMigrations/${uid}`);
  const reservedRef = adminDb.doc(`_trustedPollIds/${pollId}`);
  return adminDb.runTransaction(async tx => {
    const [receipt, snapshot, migration, reserved] = await Promise.all([tx.get(receiptRef), tx.get(pollRef), tx.get(migrationRef), tx.get(reservedRef)]);
    if (receipt.exists) {
      if (receipt.data().fingerprint !== fingerprint) throw new Error('request-id-reused');
      return receipt.data().result;
    }
    // Fail closed for any migration marker, including a completed/retired source.
    if (migration.exists) throw new Error('identity-migration-locked');
    const now = Timestamp.now();
    if (action === 'forget') {
      tx.delete(adminDb.doc(`usersV2/${uid}/history/${pollId}`));
      const result = { pollId };
      tx.create(receiptRef, { uid, fingerprint, result, createdAt: now });
      return result;
    }
    let poll = snapshot.data();
    let result = { pollId };
    if (action === 'create') {
      if (snapshot.exists || reserved.exists) throw new Error('poll-exists');
      if (!Array.isArray(payload.dates) || !payload.dates.length || payload.dates.length > 92
        || new Set(payload.dates).size !== payload.dates.length) throw new Error('invalid-dates');
      const dates = payload.dates.map((date, i) => {
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('invalid-date');
        const parsed = new Date(`${date}T00:00:00Z`);
        if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('invalid-date');
        return { id: `date${i}`, date, votes: [], comments: [] };
      });
      poll = { id: pollId, schemaVersion: 2, ownerUid: uid, title: string(payload.title, 100), createdAt: now, closed: false, dates, games: [] };
      deadline(poll, payload.deadline);
      capacity(poll, payload);
      tx.create(reservedRef, { createdAt: now });
    } else {
      if (!snapshot.exists || poll.schemaVersion !== 2) throw new Error('not-trusted-poll');
      if (['close', 'finalize', 'rename', 'deadline', 'capacity', 'addDate', 'removeDate', 'removeGame', 'delete'].includes(action)) {
        if (poll.ownerUid !== uid) throw new Error('not-owner');
        if (action === 'rename') poll.title = string(payload.title, 100);
        if (action === 'close') {
          if (typeof payload.closed !== 'boolean') throw new Error('invalid-closed');
          poll.closed = payload.closed;
          if (payload.clearDeadline !== undefined && typeof payload.clearDeadline !== 'boolean') throw new Error('invalid-clear-deadline');
          if (payload.clearDeadline) delete poll.deadline;
        }
        if (action === 'deadline') deadline(poll, payload.deadline);
        if (action === 'capacity') capacity(poll, payload);
        if (action === 'addDate') {
          validDate(payload.date);
          if (poll.dates.length >= 92 || poll.dates.some(d => d.date === payload.date)) throw new Error('duplicate-or-limit');
          poll.dates.push({ id: `date-${hash(requestId).slice(0, 16)}`, date: payload.date, votes: [], comments: [] });
        }
        if (action === 'removeDate') {
          if (poll.dates.length <= 1 || poll.finalizedDateId === payload.dateId || !poll.dates.some(d => d.id === payload.dateId)) throw new Error('invalid-date-removal');
          poll.dates = poll.dates.filter(d => d.id !== payload.dateId);
        }
        if (action === 'removeGame') {
          if (!poll.games.some(g => g.id === payload.gameId)) throw new Error('invalid-game');
          poll.games = poll.games.filter(g => g.id !== payload.gameId);
        }
        if (action === 'finalize') {
          if (payload.dateId !== null && !poll.dates.some(d => d.id === payload.dateId)) throw new Error('invalid-date');
          if (payload.dateId === null) delete poll.finalizedDateId;
          else poll.finalizedDateId = payload.dateId;
        }
      } else if (action !== 'visit') {
        if (poll.closed || poll.finalizedDateId || (poll.deadline && poll.deadline.toMillis() <= now.toMillis())) throw new Error('voting-closed');
        const name = string(payload.name, 80);
        const author = { uid, voterId: uid, voterName: name };
        if (action === 'vote' || action === 'comment') {
          const date = poll.dates.find(d => d.id === payload.dateId);
          if (!date) throw new Error('invalid-date');
          if (action === 'vote') {
            if (!['yes', 'no', 'maybe', null].includes(payload.response)) throw new Error('invalid-response');
            if (payload.guests !== undefined && (!Number.isInteger(payload.guests) || payload.guests < 0 || payload.guests > 9)) throw new Error('invalid-guests');
            const old = date.votes.find(v => v.uid === uid);
            date.votes = date.votes.filter(v => v.uid !== uid);
            date.withdrawals = (date.withdrawals ?? []).filter(v => v.uid !== uid);
            if (payload.response === null) date.withdrawals.push({ uid, timestamp: now });
            if (payload.response !== null) date.votes.push({ id: hash(`${pollId}:${date.id}:${uid}`).slice(0, 24), ...author,
              response: payload.response, guests: payload.response === 'no' ? 0 : (payload.guests ?? old?.guests ?? 0), timestamp: now });
            if (date.votes.length > 200 || date.withdrawals.length > 200) throw new Error('vote-limit');
          } else {
            if (date.comments.length >= 500) throw new Error('comment-limit');
            const commentId = hash(`${uid}:${requestId}`).slice(0, 24);
            date.comments.push({ id: commentId, ...author, text: string(payload.text, 2000), timestamp: now });
            result = { pollId, commentId };
          }
        }
        if (action === 'game') {
          const title = string(payload.title, 80);
          if (poll.games.length >= 30 || poll.games.some(g => g.title.toLowerCase() === title.toLowerCase())) throw new Error('duplicate-or-limit');
          const url = payload.url ?? '';
          if (typeof url !== 'string' || url.length > 2000) throw new Error('invalid-url');
          if (url && !['https:', 'http:'].includes(new URL(url).protocol)) throw new Error('invalid-url');
          const gameId = hash(`${uid}:${requestId}`).slice(0, 24);
          poll.games.push({ id: gameId, title, url, suggestedById: uid, suggestedByUid: uid,
            suggestedBy: name, timestamp: now, votes: [{ ...author, timestamp: now }] });
          result = { pollId, gameId };
        }
        if (action === 'gameVote') {
          const game = poll.games.find(g => g.id === payload.gameId);
          if (!game || typeof payload.selected !== 'boolean') throw new Error('invalid-game-vote');
          game.votes = game.votes.filter(v => v.uid !== uid);
          game.withdrawals = (game.withdrawals ?? []).filter(v => v.uid !== uid);
          if (!payload.selected) game.withdrawals.push({ uid, timestamp: now });
          if (payload.selected) game.votes.push({ ...author, timestamp: now });
          if (game.votes.length > 200 || game.withdrawals.length > 200) throw new Error('vote-limit');
        }
      }
    }
    if (Buffer.byteLength(JSON.stringify(poll)) > 800000) throw new Error('poll-size-limit');
    const historyRef = adminDb.doc(`usersV2/${uid}/history/${pollId}`);
    if (action === 'delete') {
      tx.delete(pollRef);
      tx.delete(historyRef);
    } else {
      if (action !== 'visit') tx.set(pollRef, poll);
      tx.set(historyRef, { title: poll.title, lastSeen: now, createdByMe: poll.ownerUid === uid });
      // Kept when a bookmark is forgotten: participation still belongs to this identity.
      tx.set(adminDb.doc(`_identityPolls/${uid}/polls/${pollId}`), { present: true });
    }
    tx.create(receiptRef, { uid, fingerprint, result, createdAt: now });
    return result;
  });
}
