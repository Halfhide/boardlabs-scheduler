import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, terminate } from 'firebase/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, closeService } from './admin.mjs';
import { trustedActivity } from '../../server/trusted-activity.mjs';
import { migrateTrustedIdentity } from '../../server/trusted-migration.mjs';
import { trustedRead } from '../../server/trusted-read.mjs';
import { trustedHandler } from '../../server/handler.mjs';

const checks = [], sessions = [];
const check = async (name, run) => { await run(); checks.push(name); console.log(`PASS: ${name}`); };
const server = createServer((req, res) => trustedHandler(req, res, req.url.split('/').at(-1)));
await new Promise(resolve => server.listen(15175, '127.0.0.1', resolve));
async function user(name, anonymous = false) {
  const app = initializeApp({ projectId: 'demo-meppletime-local', apiKey: 'fake-key' }, name);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:19099', { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 18080);
  sessions.push({ app, db });
  if (anonymous) await signInAnonymously(auth); else await createUserWithEmailAndPassword(auth, `${name}@example.test`, 'Synthetic-password-123!');
  return { uid: auth.currentUser.uid, token: await auth.currentUser.getIdToken(), db };
}
let sequence = 0;
const command = (who, pollId, action, payload, requestId = `release-${++sequence}`) => trustedActivity(who.token, { requestId, pollId, action, payload });
try {
  const source = await user('release-guest', true), target = await user('release-target'), other = await user('release-other');
  await check('Production rules deny direct v2 reads and writes; API serves public polls and private history', async () => {
    await command(source, 'v2_owned00000000000', 'create', { title: 'Owned poll', dates: ['2026-11-20'] });
    await assert.rejects(setDoc(doc(source.db, 'pollsV2/v2_forged'), { ownerUid: source.uid }), e => e.code === 'permission-denied');
    await assert.rejects(getDoc(doc(source.db, 'pollsV2/v2_owned00000000000')), e => e.code === 'permission-denied');
    assert.equal((await trustedRead(null, { action: 'poll', pollId: 'v2_owned00000000000' })).poll.ownerUid, source.uid);
    assert.equal((await trustedRead(target.token, { action: 'history' })).polls.v2_owned00000000000, undefined);
    assert.equal((await trustedRead(source.token, { action: 'history' })).polls.v2_owned00000000000.createdByMe, true);
    await assert.rejects(trustedRead(target.token, { action: 'history', uid: source.uid }));
  });
  await check('Identity forgery, owner commands by strangers and reused request IDs are refused', async () => {
    await assert.rejects(command(other, 'v2_owned00000000000', 'rename', { title: 'Stolen' }));
    await assert.rejects(command(other, 'v2_owned00000000000', 'vote', { dateId: 'date0', name: 'Fake', uid: source.uid, response: 'yes' }));
    await command(source, 'v2_owned00000000000', 'comment', { dateId: 'date0', name: 'Guest', text: 'Keep me' }, 'same-command');
    await command(source, 'v2_owned00000000000', 'comment', { dateId: 'date0', name: 'Guest', text: 'Keep me' }, 'same-command');
    await assert.rejects(command(source, 'v2_owned00000000000', 'comment', { dateId: 'date0', name: 'Guest', text: 'Changed' }, 'same-command'));
    assert.equal((await adminDb.doc('pollsV2/v2_owned00000000000').get()).data().dates[0].comments.length, 1);
  });
  await check('HTTP rejects wrong origins, missing identities, oversized and malformed bodies', async () => {
    const post = (body, extra = {}, route = 'trusted-activity') => fetch(`http://127.0.0.1:15175/api/${route}`, { method: 'POST',
      headers: { origin: 'http://127.0.0.1:15173', 'content-type': 'application/json', ...extra }, body });
    assert.equal((await post('{}', { origin: 'https://evil.example' })).status, 403);
    assert.equal((await post('{}')).status, 401);
    assert.equal((await post('{')).status, 400);
    assert.equal((await post('x'.repeat(20001))).status, 413);
    assert.equal((await post(JSON.stringify({ action: 'poll', pollId: 'v2_owned00000000000' }), {}, 'trusted-read')).status, 200);
    assert.equal((await post('{}', { authorization: 'Bearer invalid' }, 'trusted-status')).status, 400);
  });
  await check('Discovery pages beyond 500 polls and history rows without a permanent freeze', async () => {
    for (let offset = 0; offset < 603; offset += 200) {
      const batch = adminDb.batch();
      for (let i = offset; i < Math.min(603, offset + 200); i++) batch.set(adminDb.doc(`pollsV2/v2_a${String(i).padStart(4, '0')}`), {
        schemaVersion: 2, ownerUid: other.uid, title: 'Other poll', dates: [], games: [], createdAt: Timestamp.now(),
      });
      await batch.commit();
    }
    for (let offset = 0; offset < 503; offset += 200) {
      const batch = adminDb.batch();
      for (let i = offset; i < Math.min(503, offset + 200); i++) {
        batch.set(adminDb.doc(`usersV2/${source.uid}/history/v2_missing${i}`), {
          title: 'Deleted poll', lastSeen: Timestamp.now(), createdByMe: false,
        });
        batch.set(adminDb.doc(`_identityPolls/${source.uid}/polls/v2_missing${i}`), { present: true });
      }
      await batch.commit();
    }
    await command(source, 'v2_owned00000000000', 'forget', {});
    const proof = { guestToken: source.token, accountToken: target.token };
    const first = await migrateTrustedIdentity(proof);
    assert.equal(first.state, 'running');
    await assert.rejects(command(source, 'v2_locked0000000000', 'create', { title: 'Blocked', dates: ['2026-11-20'] }), /identity-migration-locked/);
    await assert.rejects(migrateTrustedIdentity({ ...proof, accountToken: other.token }), /destination-locked/);
    let final;
    // Concurrent discovery cannot rewind a cursor or count entries twice.
    await Promise.all([migrateTrustedIdentity(proof), migrateTrustedIdentity(proof)]);
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await migrateTrustedIdentity(proof);
      if (result.state === 'complete') { final = result; break; }
    }
    assert.deepEqual(final, { state: 'complete', total: 504, remaining: 0 });
    const job = adminDb.doc(`_identityMigrations/${source.uid}`);
    assert.equal((await job.collection('polls').get()).size, 504);
    const before = (await job.get()).data().completedAt.toMillis();
    assert.deepEqual(await migrateTrustedIdentity(proof), final);
    assert.equal((await job.get()).data().completedAt.toMillis(), before);
    const migrated = (await adminDb.doc('pollsV2/v2_owned00000000000').get()).data();
    assert.equal(migrated.ownerUid, target.uid);
    assert.equal(migrated.dates[0].comments[0].uid, target.uid);
    assert.equal((await adminDb.doc('pollsV2/v2_a0000').get()).data().ownerUid, other.uid);
  });
  await check('A crashed worker lease expires and cannot permanently block an empty guest', async () => {
    const guest = await user('lease-guest', true);
    const ref = adminDb.doc(`_identityMigrationLocks/${guest.uid}`);
    const proof = { guestToken: guest.token, accountToken: target.token };
    await ref.set({ owner: 'interrupted-worker', until: Timestamp.fromMillis(Date.now() + 90000) });
    assert.equal((await migrateTrustedIdentity(proof)).retryAfterMs, 1000);
    await ref.update({ until: Timestamp.fromMillis(Date.now() - 1) });
    assert.deepEqual(await migrateTrustedIdentity(proof), { state: 'complete', total: 0, remaining: 0 });
    assert.equal((await ref.get()).exists, false);
  });
  await check('Local bookmarks cannot manufacture ownership and deleted IDs cannot be recreated', async () => {
    await command(other, 'v2_owned00000000000', 'visit', {});
    assert.equal((await trustedRead(other.token, { action: 'history' })).polls.v2_owned00000000000.createdByMe, false);
    await command(target, 'v2_owned00000000000', 'delete', {});
    await assert.rejects(command(target, 'v2_owned00000000000', 'create', { title: 'Reused', dates: ['2026-11-20'] }), /poll-exists/);
  });
  await writeFile('tests/results/release-backend-result.json', JSON.stringify({ testedAt: new Date().toISOString(), checks }, null, 2));
} finally {
  await new Promise(resolve => server.close(resolve));
  await fetch('http://127.0.0.1:18080/emulator/v1/projects/demo-meppletime-local/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:19099/emulator/v1/projects/demo-meppletime-local/accounts', { method: 'DELETE' });
  for (const session of sessions) { await terminate(session.db); await deleteApp(session.app); }
  await closeService();
}
