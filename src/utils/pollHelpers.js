import { doc, setDoc, runTransaction, deleteField } from 'firebase/firestore';
import { nanoid } from 'nanoid';
import { db } from '../firebase';

// Firestore documents are capped at 1 MB; 92 dates keeps polls well
// under it and matches the create-form range limit
export const MAX_POLL_DATES = 92;

// Errors shown to users carry a `code` matching a translation key
// (plus optional params); the message stays English for the console
function appError(code, message, params) {
  return Object.assign(new Error(message), { code, params });
}

/**
 * Create a new poll
 * @param {string} title - Poll title
 * @param {string[]} dateStrings - Array of ISO date strings
 * @param {{deadline?: Date|null, minPlayers?: number|null, maxPlayers?: number|null}} options
 * @returns {Promise<{pollId: string, creatorToken: string}>} Poll ID and creator token
 */
export async function createPoll(title, dateStrings, options = {}) {
  const { deadline = null, minPlayers = null, maxPlayers = null } = options;

  try {
    const pollId = nanoid(10);
    const creatorToken = nanoid(16);
    const pollRef = doc(db, 'polls', pollId);

    const pollData = {
      id: pollId,
      title,
      createdAt: new Date(),
      creatorToken,
      closed: false,
      ...(deadline ? { deadline } : {}),
      ...(minPlayers ? { minPlayers } : {}),
      ...(maxPlayers ? { maxPlayers } : {}),
      dates: dateStrings.map((dateString, index) => ({
        id: `date${index}`,
        date: dateString,
        votes: [],
        comments: []
      }))
    };

    await setDoc(pollRef, pollData);
    return { pollId, creatorToken };
  } catch (error) {
    console.error('Error creating poll:', error);
    throw error;
  }
}

/**
 * Run a creator-only poll update inside a transaction. The mutate
 * callback receives the current poll data and returns the fields to
 * update. Creator identity is checked against the stored token; this
 * is client-side gating until real auth (roadmap phase 5).
 */
async function runCreatorUpdate(pollId, creatorToken, mutate) {
  const pollRef = doc(db, 'polls', pollId);

  await runTransaction(db, async (transaction) => {
    const pollSnap = await transaction.get(pollRef);

    if (!pollSnap.exists()) {
      throw appError('errPollNotFound', 'Poll not found');
    }

    const poll = pollSnap.data();

    if (!poll.creatorToken || poll.creatorToken !== creatorToken) {
      throw appError('errNotCreator', 'Only the poll creator can do this');
    }

    transaction.update(pollRef, mutate(poll));
  });
}

/**
 * Rename a poll (creator only)
 */
export async function updatePollTitle(pollId, creatorToken, title) {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 100) {
    throw appError('errTitleLength', 'Title must be between 1 and 100 characters');
  }

  try {
    await runCreatorUpdate(pollId, creatorToken, () => ({ title: trimmed }));
  } catch (error) {
    console.error('Error renaming poll:', error);
    throw error;
  }
}

/**
 * Close or reopen voting on a poll (creator only)
 * @param {boolean} clearDeadline - Also remove the deadline; used when
 *   reopening a poll whose deadline has passed, which would otherwise
 *   keep it closed
 */
export async function setPollClosed(pollId, creatorToken, closed, clearDeadline = false) {
  try {
    await runCreatorUpdate(pollId, creatorToken, () => ({
      closed,
      ...(clearDeadline ? { deadline: deleteField() } : {})
    }));
  } catch (error) {
    console.error('Error updating poll closed state:', error);
    throw error;
  }
}

/**
 * Set or remove the voting deadline (creator only)
 * @param {Date|null} deadline - New deadline, or null to remove it
 */
export async function setPollDeadline(pollId, creatorToken, deadline) {
  if (deadline !== null && (!(deadline instanceof Date) || isNaN(deadline.getTime()))) {
    throw appError('errInvalidDeadline', 'Invalid deadline');
  }

  try {
    await runCreatorUpdate(pollId, creatorToken, () => ({
      deadline: deadline ?? deleteField()
    }));
  } catch (error) {
    console.error('Error updating poll deadline:', error);
    throw error;
  }
}

/**
 * Add a date to a poll (creator only)
 * @param {string} dateString - ISO date string (YYYY-MM-DD)
 */
export async function addPollDate(pollId, creatorToken, dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw appError('errInvalidDate', 'Invalid date');
  }

  try {
    await runCreatorUpdate(pollId, creatorToken, (poll) => {
      if (poll.dates.some(d => d.date === dateString)) {
        throw appError('errDateExists', 'That date is already in the poll');
      }
      if (poll.dates.length >= MAX_POLL_DATES) {
        throw appError('errTooManyDates', `A poll can have at most ${MAX_POLL_DATES} dates`, { max: MAX_POLL_DATES });
      }

      return {
        dates: [
          ...poll.dates,
          { id: `date-${nanoid(8)}`, date: dateString, votes: [], comments: [] }
        ]
      };
    });
  } catch (error) {
    console.error('Error adding poll date:', error);
    throw error;
  }
}

/**
 * Set or clear the player capacity (creator only). Pass null for a
 * bound to remove it.
 */
export async function setPollCapacity(pollId, creatorToken, minPlayers, maxPlayers) {
  const validate = (value, label) => {
    if (value !== null && (!Number.isInteger(value) || value < 1 || value > 99)) {
      throw appError('errPlayersRange', `${label} must be a whole number between 1 and 99`);
    }
  };
  validate(minPlayers, 'Minimum players');
  validate(maxPlayers, 'Maximum players');
  if (minPlayers !== null && maxPlayers !== null && maxPlayers < minPlayers) {
    throw appError('errMaxBelowMin', 'Maximum players cannot be lower than minimum players');
  }

  try {
    await runCreatorUpdate(pollId, creatorToken, () => ({
      minPlayers: minPlayers ?? deleteField(),
      maxPlayers: maxPlayers ?? deleteField()
    }));
  } catch (error) {
    console.error('Error updating poll capacity:', error);
    throw error;
  }
}

/**
 * Describe a date's viability given the poll's player capacity
 * @param {Array} votes - The date's votes
 * @param {number|null} minPlayers
 * @param {number|null} maxPlayers
 * @returns {{key: 'needs'|'enough'|'full', needed: number}|null} null
 *   when the poll has no capacity settings; `needed` is how many more
 *   yes-votes reach the minimum (0 unless key is 'needs'). Rendered
 *   via the capacityFull/capacityEnough/capacityNeeds i18n keys.
 */
export function getCapacityStatus(votes, minPlayers, maxPlayers) {
  const min = minPlayers ?? null;
  const max = maxPlayers ?? null;
  if (!min && !max) return null;

  const summary = getVoteSummary(votes);

  if (max && summary.yes >= max) {
    return { key: 'full', needed: 0 };
  }
  if (min && summary.yes < min) {
    return { key: 'needs', needed: min - summary.yes };
  }
  return { key: 'enough', needed: 0 };
}

/**
 * Finalize the poll on a chosen date, or un-finalize it (creator only)
 * @param {string|null} dateId - The winning date's ID, or null to
 *   un-finalize and reopen voting
 */
export async function setFinalizedDate(pollId, creatorToken, dateId) {
  try {
    await runCreatorUpdate(pollId, creatorToken, (poll) => {
      if (dateId !== null && !poll.dates.some(d => d.id === dateId)) {
        throw appError('errDateNotFound', 'Date not found');
      }
      return { finalizedDateId: dateId ?? deleteField() };
    });
  } catch (error) {
    console.error('Error finalizing poll:', error);
    throw error;
  }
}

/**
 * Remove a date from a poll, including its votes and comments
 * (creator only)
 */
export async function removePollDate(pollId, creatorToken, dateId) {
  try {
    await runCreatorUpdate(pollId, creatorToken, (poll) => {
      if (poll.dates.length <= 1) {
        throw appError('errLastDate', 'A poll must keep at least one date');
      }
      if (poll.finalizedDateId === dateId) {
        throw appError('errUnfinalizeFirst', 'Un-finalize the poll before removing the chosen date');
      }

      const remaining = poll.dates.filter(d => d.id !== dateId);
      if (remaining.length === poll.dates.length) {
        throw appError('errDateNotFound', 'Date not found');
      }

      return { dates: remaining };
    });
  } catch (error) {
    console.error('Error removing poll date:', error);
    throw error;
  }
}

/**
 * Check whether a vote belongs to a voter. Matches by stable voter ID,
 * falling back to name for votes recorded before voter IDs existed.
 */
export function isVoteByVoter(vote, voterId, voterName) {
  return vote.voterId ? vote.voterId === voterId : vote.voterName === voterName;
}

/**
 * Find a voter's existing vote in a list of votes
 * @param {Array} votes - Array of vote objects
 * @param {string} voterId - Stable per-browser voter ID
 * @param {string} voterName - Voter's display name
 * @returns {Object|undefined} The voter's vote, if any
 */
export function findUserVote(votes, voterId, voterName) {
  return votes.find(v => isVoteByVoter(v, voterId, voterName));
}

/**
 * Add a vote to a specific date
 * @param {string} pollId - Poll ID
 * @param {string} dateId - Date ID
 * @param {{id: string, name: string}} voter - Voter identity
 * @param {string} response - Vote response ('yes', 'no', or 'maybe')
 */
export async function addVote(pollId, dateId, voter, response) {
  try {
    const pollRef = doc(db, 'polls', pollId);

    // Run inside a transaction so concurrent voters don't overwrite
    // each other's changes to the dates array
    await runTransaction(db, async (transaction) => {
      const pollSnap = await transaction.get(pollRef);

      if (!pollSnap.exists()) {
        throw appError('errPollNotFound', 'Poll not found');
      }

      const poll = pollSnap.data();
      const dateIndex = poll.dates.findIndex(d => d.id === dateId);

      if (dateIndex === -1) {
        throw appError('errDateNotFound', 'Date not found');
      }

      // Check if voter already voted on this date
      const existingVoteIndex = poll.dates[dateIndex].votes.findIndex(
        v => isVoteByVoter(v, voter.id, voter.name)
      );

      let updatedVotes;
      if (existingVoteIndex !== -1) {
        // Update existing vote (stamping the voter ID onto legacy
        // name-only votes)
        updatedVotes = [...poll.dates[dateIndex].votes];
        updatedVotes[existingVoteIndex] = {
          id: updatedVotes[existingVoteIndex].id,
          voterId: voter.id,
          voterName: voter.name,
          response,
          timestamp: new Date()
        };
      } else {
        // Add new vote
        updatedVotes = [
          ...poll.dates[dateIndex].votes,
          {
            id: nanoid(8),
            voterId: voter.id,
            voterName: voter.name,
            response,
            timestamp: new Date()
          }
        ];
      }

      // Update the entire dates array
      const updatedDates = [...poll.dates];
      updatedDates[dateIndex] = {
        ...updatedDates[dateIndex],
        votes: updatedVotes
      };

      transaction.update(pollRef, {
        dates: updatedDates
      });
    });
  } catch (error) {
    console.error('Error adding vote:', error);
    throw error;
  }
}

/**
 * Add a comment to a specific date
 * @param {string} pollId - Poll ID
 * @param {string} dateId - Date ID
 * @param {{id: string, name: string}} voter - Commenter identity
 * @param {string} text - Comment text
 */
export async function addComment(pollId, dateId, voter, text) {
  try {
    const pollRef = doc(db, 'polls', pollId);

    // Run inside a transaction so concurrent writers don't overwrite
    // each other's changes to the dates array
    await runTransaction(db, async (transaction) => {
      const pollSnap = await transaction.get(pollRef);

      if (!pollSnap.exists()) {
        throw appError('errPollNotFound', 'Poll not found');
      }

      const poll = pollSnap.data();
      const dateIndex = poll.dates.findIndex(d => d.id === dateId);

      if (dateIndex === -1) {
        throw appError('errDateNotFound', 'Date not found');
      }

      const newComment = {
        id: nanoid(8),
        voterId: voter.id,
        voterName: voter.name,
        text,
        timestamp: new Date()
      };

      // Update the entire dates array with new comment
      const updatedDates = [...poll.dates];
      updatedDates[dateIndex] = {
        ...updatedDates[dateIndex],
        comments: [...updatedDates[dateIndex].comments, newComment]
      };

      transaction.update(pollRef, {
        dates: updatedDates
      });
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
}

// A poll can collect up to this many game suggestions
export const MAX_GAMES = 30;

/**
 * Suggest a game to play. Any named participant can do this; the
 * suggester automatically votes for their own suggestion.
 * @param {{id: string, name: string}} voter
 * @param {string} title - Game title
 * @param {string} url - Optional link (e.g. BoardGameGeek)
 */
export async function addGame(pollId, voter, title, url = '') {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 80) {
    throw appError('errGameTitleLength', 'Game title must be between 1 and 80 characters');
  }
  const cleanUrl = (url || '').trim();
  if (cleanUrl && !/^https?:\/\//i.test(cleanUrl)) {
    throw appError('errGameLink', 'The link must start with http:// or https://');
  }
  if (cleanUrl.length > 300) {
    throw appError('errGameLinkLong', 'The link is too long');
  }

  try {
    const pollRef = doc(db, 'polls', pollId);

    await runTransaction(db, async (transaction) => {
      const pollSnap = await transaction.get(pollRef);
      if (!pollSnap.exists()) {
        throw appError('errPollNotFound', 'Poll not found');
      }

      const games = pollSnap.data().games ?? [];
      if (games.length >= MAX_GAMES) {
        throw appError('errTooManyGames', `A poll can have at most ${MAX_GAMES} game suggestions`, { max: MAX_GAMES });
      }
      if (games.some(g => g.title.toLowerCase() === trimmed.toLowerCase())) {
        throw appError('errDuplicateGame', 'That game has already been suggested');
      }

      const newGame = {
        id: nanoid(8),
        title: trimmed,
        ...(cleanUrl ? { url: cleanUrl } : {}),
        suggestedById: voter.id,
        suggestedBy: voter.name,
        votes: [{ voterId: voter.id, voterName: voter.name }]
      };

      transaction.update(pollRef, { games: [...games, newGame] });
    });
  } catch (error) {
    console.error('Error suggesting game:', error);
    throw error;
  }
}

/**
 * Toggle the voter's vote on a game suggestion (one vote per game
 * per voter)
 */
export async function toggleGameVote(pollId, gameId, voter) {
  try {
    const pollRef = doc(db, 'polls', pollId);

    await runTransaction(db, async (transaction) => {
      const pollSnap = await transaction.get(pollRef);
      if (!pollSnap.exists()) {
        throw appError('errPollNotFound', 'Poll not found');
      }

      const games = pollSnap.data().games ?? [];
      const index = games.findIndex(g => g.id === gameId);
      if (index === -1) {
        throw appError('errGameNotFound', 'Game not found');
      }

      const game = games[index];
      const hasVoted = game.votes.some(v => v.voterId === voter.id);
      const votes = hasVoted
        ? game.votes.filter(v => v.voterId !== voter.id)
        : [...game.votes, { voterId: voter.id, voterName: voter.name }];

      const updated = [...games];
      updated[index] = { ...game, votes };
      transaction.update(pollRef, { games: updated });
    });
  } catch (error) {
    console.error('Error voting on game:', error);
    throw error;
  }
}

/**
 * Remove a game suggestion (creator only)
 */
export async function removeGame(pollId, creatorToken, gameId) {
  try {
    await runCreatorUpdate(pollId, creatorToken, (poll) => {
      const games = poll.games ?? [];
      const remaining = games.filter(g => g.id !== gameId);
      if (remaining.length === games.length) {
        throw appError('errGameNotFound', 'Game not found');
      }
      return { games: remaining };
    });
  } catch (error) {
    console.error('Error removing game:', error);
    throw error;
  }
}

/**
 * The game suggestion with the most votes (ties go to the earlier
 * suggestion), or null when there are none
 */
export function getLeadingGame(games) {
  if (!games || games.length === 0) return null;
  return games.reduce((best, game) =>
    game.votes.length > best.votes.length ? game : best
  );
}

/**
 * Group votes by response
 * @param {Array} votes - Array of vote objects
 * @returns {{yes: Array, maybe: Array, no: Array}} Votes per response
 */
export function groupVotesByResponse(votes) {
  return votes.reduce(
    (acc, vote) => {
      (acc[vote.response] ??= []).push(vote);
      return acc;
    },
    { yes: [], maybe: [], no: [] }
  );
}

/**
 * Calculate vote summary for a date
 * @param {Array} votes - Array of vote objects
 * @returns {Object} Vote counts
 */
export function getVoteSummary(votes) {
  return votes.reduce(
    (acc, vote) => {
      acc[vote.response] = (acc[vote.response] || 0) + 1;
      return acc;
    },
    { yes: 0, no: 0, maybe: 0 }
  );
}

/**
 * Find the best dates based on votes
 * @param {Array} dates - Array of date objects
 * @param {number|null} minPlayers - When set, dates with enough yes
 *   votes to actually play rank before dates without
 * @returns {Array} Sorted dates (best first)
 */
export function getBestDates(dates, minPlayers = null) {
  return [...dates].sort((a, b) => {
    const aYes = a.votes.filter(v => v.response === 'yes').length;
    const bYes = b.votes.filter(v => v.response === 'yes').length;

    if (minPlayers) {
      const aViable = aYes >= minPlayers;
      const bViable = bYes >= minPlayers;
      if (aViable !== bViable) return aViable ? -1 : 1;
    }

    if (aYes !== bYes) return bYes - aYes;

    // If same number of yes votes, prefer fewer no votes
    const aNo = a.votes.filter(v => v.response === 'no').length;
    const bNo = b.votes.filter(v => v.response === 'no').length;

    if (aNo !== bNo) return aNo - bNo;

    // Finally, prefer more maybe votes
    const aMaybe = a.votes.filter(v => v.response === 'maybe').length;
    const bMaybe = b.votes.filter(v => v.response === 'maybe').length;

    return bMaybe - aMaybe;
  });
}
