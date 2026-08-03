// Stages the demo poll used for landing-page screenshots (feature 14
// and later refreshes), then hands it to the expiry cron for cleanup.
//
//   node scripts/stage-demo-poll.mjs create
//     Creates an unowned demo poll with 10 dates (7-16 Aug 2026),
//     five voters and three game suggestions, and prints its URL.
//
//   node scripts/stage-demo-poll.mjs expire <pollId>
//     Rewrites the poll's dates to January 2024. The nightly Vercel
//     expiry cron (api/expire-polls.js, 03:14 UTC) then deletes the
//     poll on its next run: unowned polls cannot be deleted through
//     the rules, so this is the sanctioned cleanup path.
//
// Uses the Firebase web SDK with the config from .env, so every write
// obeys the production Firestore rules like a real visitor's would.

import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { nanoid } from 'nanoid';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app);

const [mode, pollIdArg] = process.argv.slice(2);

const VOTERS = {
  ania: { id: 'demo-ania', name: 'Ania' },
  kasia: { id: 'demo-kasia', name: 'Kasia' },
  marek: { id: 'demo-marek', name: 'Marek' },
  ola: { id: 'demo-ola', name: 'Ola' },
  piotr: { id: 'demo-piotr', name: 'Piotr' },
};

// day-of-August -> [voterKey, response]
const VOTE_PLAN = {
  7: [['kasia', 'maybe'], ['marek', 'no'], ['ola', 'yes'], ['piotr', 'yes']],
  8: [['ania', 'maybe'], ['kasia', 'yes'], ['marek', 'yes'], ['ola', 'yes']],
  9: [['marek', 'maybe'], ['piotr', 'no']],
  10: [['kasia', 'no'], ['ola', 'no']],
  12: [['ania', 'yes'], ['piotr', 'maybe']],
  14: [['ania', 'yes'], ['kasia', 'yes'], ['marek', 'yes'], ['ola', 'yes'], ['piotr', 'yes']],
  15: [['kasia', 'yes'], ['ola', 'maybe'], ['piotr', 'yes']],
};

const GAMES = [
  { title: 'Wingspan', url: 'https://boardgamegeek.com/boardgame/266192', by: 'kasia', voters: ['kasia', 'ania', 'piotr'] },
  { title: 'Catan', url: 'https://boardgamegeek.com/boardgame/13', by: 'ola', voters: ['ola', 'marek'] },
  { title: 'Azul', url: 'https://boardgamegeek.com/boardgame/230802', by: 'marek', voters: ['marek'] },
];

function voteEntry(voterKey, response) {
  const v = VOTERS[voterKey];
  return { id: nanoid(8), voterId: v.id, voterName: v.name, response, timestamp: new Date() };
}

if (mode === 'create') {
  const pollId = nanoid(10);
  await setDoc(doc(db, 'polls', pollId), {
    id: pollId,
    title: 'Demo poll for landing screenshots - safe to ignore',
    createdAt: new Date(),
    creatorToken: nanoid(16),
    closed: false,
    dates: Array.from({ length: 10 }, (_, i) => {
      const day = 7 + i;
      return {
        id: `date${i}`,
        date: `2026-08-${String(day).padStart(2, '0')}`,
        votes: (VOTE_PLAN[day] ?? []).map(([who, response]) => voteEntry(who, response)),
        comments: [],
      };
    }),
  });
  // games are forbidden on create by the rules; add them in an update
  await updateDoc(doc(db, 'polls', pollId), {
    games: GAMES.map((g) => ({
      id: nanoid(8),
      title: g.title,
      url: g.url,
      suggestedById: VOTERS[g.by].id,
      suggestedBy: VOTERS[g.by].name,
      votes: g.voters.map((who) => ({ voterId: VOTERS[who].id, voterName: VOTERS[who].name })),
    })),
  });
  console.log(`created ${pollId}`);
  console.log(`https://app.meppletime.today/poll/${pollId}`);
} else if (mode === 'expire' && pollIdArg) {
  const ref = doc(db, 'polls', pollIdArg);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('poll not found');
  const dates = snap.data().dates.map((d, i) => ({
    ...d,
    date: `2024-01-${String(i + 1).padStart(2, '0')}`,
  }));
  await updateDoc(ref, { dates });
  console.log(`${pollIdArg} dates moved to Jan 2024; the nightly expiry cron will delete it`);
} else {
  console.error('usage: node scripts/stage-demo-poll.mjs create | expire <pollId>');
  process.exit(1);
}
process.exit(0);
