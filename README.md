# Board Game Scheduler

A lightweight Doodle-style app for finding the best date for a board game
night. Create a poll with a range of candidate dates, share the link, and
everyone votes Yes / Maybe / No on each date. Results update in real time.

## Features

- Create a poll from a title and a date range (each day becomes a votable
  option, up to 92 days)
- Shareable link, no accounts required: voters just enter a name, which is
  remembered in the browser along with a stable anonymous voter ID, so
  renaming yourself keeps your votes and two voters with the same name
  don't clash
- Calendar view covering every month in the poll range, color-coded by your
  own votes
- Per-date comments
- Live results grid ranked by most Yes votes (ties broken by fewest No,
  then most Maybe), with the best date highlighted
- Confetti. A lot of confetti.

## Tech stack

- [React 19](https://react.dev/) + [Vite](https://vite.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Firebase Firestore](https://firebase.google.com/docs/firestore) for
  storage and real-time updates (no authentication)
- [React Router](https://reactrouter.com/), [date-fns](https://date-fns.org/),
  [nanoid](https://github.com/ai/nanoid),
  [canvas-confetti](https://github.com/catdad/canvas-confetti)

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Firebase project with a Firestore database, then copy
   `.env.example` to `.env` and fill in your Firebase web app config
   (`VITE_FIREBASE_*` variables).

3. Apply the Firestore security rules from `firebase-rules.txt` in the
   Firebase console.

4. Run the dev server:

   ```bash
   npm run dev
   ```

## Scripts

| Command           | Description                      |
| ----------------- | -------------------------------- |
| `npm run dev`     | Start the Vite dev server        |
| `npm run build`   | Production build into `dist/`    |
| `npm run preview` | Preview the production build     |
| `npm run lint`    | Run ESLint                       |

## Deployment

The app is a single-page application. `vercel.json` rewrites all routes to
`index.html` so direct poll links (`/poll/<id>`) work on Vercel. Remember to
set the `VITE_FIREBASE_*` environment variables in your Vercel project.

## Data model

One Firestore document per poll in the `polls` collection:

```
polls/<pollId>
  title: string
  createdAt: timestamp
  dates: [
    { id, date: 'YYYY-MM-DD',
      votes: [{ id, voterId, voterName, response, timestamp }],
      comments: [{ id, voterId, voterName, text, timestamp }] }
  ]
```

`voterId` is a random ID generated once per browser and kept in
localStorage. Votes are matched by it, with a fallback to `voterName`
for votes recorded before voter IDs existed.

Votes and comments are written inside Firestore transactions so concurrent
voters do not overwrite each other.

Note: polls are public. The Firestore rules keep a poll's title, creation
time and set of dates immutable and forbid deletion, but anyone with the
link can still add or change votes, so this is meant for friendly groups,
not adversarial environments.
