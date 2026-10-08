/* global process */
// Vercel cron function that deletes expired polls (roadmap 11e): any
// poll whose LATEST offered date is more than EXPIRY_MONTHS (default
// 12) in the past. Uses the Firebase Admin SDK, which bypasses the
// Firestore security rules, so the caller must prove it is Vercel's
// cron: Vercel automatically sends "Authorization: Bearer $CRON_SECRET"
// when the CRON_SECRET env var is set on the project.
//
// Env (Vercel project settings):
// - FIREBASE_SERVICE_ACCOUNT: the full service-account JSON
// - CRON_SECRET: shared secret, sent by Vercel cron automatically
// - EXPIRY_MONTHS (optional): override the 12-month window

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';

const BATCH_LIMIT = 500; // Firestore's max writes per batch

function getDb() {
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

// YYYY-MM-DD in UTC, `months` months before now. Poll dates are plain
// YYYY-MM-DD strings, so lexicographic comparison is date comparison.
function cutoffString(months) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function latestDate(poll) {
  const dates = Array.isArray(poll.dates) ? poll.dates : [];
  let latest = null;
  for (const entry of dates) {
    if (typeof entry?.date === 'string' && (!latest || entry.date > latest)) {
      latest = entry.date;
    }
  }
  return latest;
}

export default async function handler(req, res) {
  const send = (status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };

  if (!process.env.CRON_SECRET || !process.env.FIREBASE_SERVICE_ACCOUNT) {
    send(500, { error: 'Missing CRON_SECRET or FIREBASE_SERVICE_ACCOUNT configuration' });
    return;
  }
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    send(401, { error: 'Unauthorized' });
    return;
  }

  const months = Number.parseInt(process.env.EXPIRY_MONTHS ?? '12', 10) || 12;
  const cutoff = cutoffString(months);

  try {
    const db = getDb();
    let scanned = 0;
    const expiredIds = [];
    for (const collectionName of ['polls', 'pollsV2']) {
      let cursor = null;
      while (true) {
        let query = db.collection(collectionName).orderBy(FieldPath.documentId()).limit(BATCH_LIMIT);
        if (cursor) query = query.startAfter(cursor);
        const snapshot = await query.get();
        scanned += snapshot.size;
        const batch = db.batch();
        let deletes = 0;
        for (const doc of snapshot.docs) {
          const latest = latestDate(doc.data());
          if (latest && latest < cutoff) { batch.delete(doc.ref); expiredIds.push(doc.id); deletes++; }
        }
        if (deletes) await batch.commit();
        if (snapshot.size < BATCH_LIMIT) break;
        cursor = snapshot.docs.at(-1).id;
      }
    }

    send(200, {
      scanned,
      deleted: expiredIds.length,
      deletedIds: expiredIds,
      cutoff,
      months
    });
  } catch (err) {
    console.error('Poll expiry failed:', err);
    send(500, { error: err.message || 'Poll expiry failed' });
  }
}
