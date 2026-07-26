import { doc, setDoc, runTransaction, deleteField, deleteDoc } from 'firebase/firestore';
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
 * @param {{deadline?: Date|null, minPlayers?: number|null, maxPlayers?: number|null, ownerUid?: string|null}} options
 *   ownerUid: the signed-in creator's account ID; polls created
 *   while signed out get one later via claimPollIdentity
 * @returns {Promise<{pollId: string, creatorToken: string}>} Poll ID and creator token
 */
export async function createPoll(title, dateStrings, options = {}) {
  const { deadline = null, minPlayers = null, maxPlayers = null, ownerUid = null } = options;

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
      ...(ownerUid ? { ownerUid } : {}),
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
 * update. Authorized either by the signed-in owner's account
 * (poll.ownerUid) or by the legacy browser token; token gating stays
 * client-side, uid gating is also enforced by the Firestore rules
 * once the poll has an owner.
 * @param {{creatorToken?: string|null, uid?: string|null}} auth
 */
async function runCreatorUpdate(pollId, auth, mutate) {
  const { creatorToken = null, uid = null } = auth || {};
  const pollRef = doc(db, 'polls', pollId);

  await runTransaction(db, async (transaction) => {
    const pollSnap = await transaction.get(pollRef);

    if (!pollSnap.exists()) {
      throw appError('errPollNotFound', 'Poll not found');
    }

    const poll = pollSnap.data();

    const isOwner = !!poll.ownerUid && !!uid && poll.ownerUid === uid;
    const hasToken = !!poll.creatorToken && creatorToken === poll.creatorToken;
    if (!isOwner && !hasToken) {
      throw appError('errNotCreator', 'Only the poll creator can do this');
    }

    transaction.update(pollRef, mutate(poll));
  });
}

/**
 * Rename a poll (creator only)
 */
export async function updatePollTitle(pollId, auth, title) {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 100) {
    throw appError('errTitleLength', 'Title must be between 1 and 100 characters');
  }

  try {
    await runCreatorUpdate(pollId, auth, () => ({ title: trimmed }));
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
export async function setPollClosed(pollId, auth, closed, clearDeadline = false) {
  try {
    await runCreatorUpdate(pollId, auth, () => ({
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
export async function setPollDeadline(pollId, auth, deadline) {
  if (deadline !== null && (!(deadline instanceof Date) || isNaN(deadline.getTime()))) {
    throw appError('errInvalidDeadline', 'Invalid deadline');
  }

  try {
    await runCreatorUpdate(pollId, auth, () => ({
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
export async function addPollDate(pollId, auth, dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw appError('errInvalidDate', 'Invalid date');
  }

  try {
    await runCreatorUpdate(pollId, auth, (poll) => {
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
export async function setPollCapacity(pollId, auth, minPlayers, maxPlayers) {
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
    await runCreatorUpdate(pollId, auth, () => ({
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
export async function setFinalizedDate(pollId, auth, dateId) {
  try {
    await runCreatorUpdate(pollId, auth, (poll) => {
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
export async function removePollDate(pollId, auth, dateId) {
  try {
    await runCreatorUpdate(pollId, auth, (poll) => {
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
 * Check whether a vote belongs to a voter. When both sides carry an
 * account ID that comparison is decisive (a claimed vote on a shared
 * computer stays with its account); otherwise match by the stable
 * per-browser voter ID, falling back to name for votes recorded
 * before voter IDs existed.
 * @param {string|null} uid - Signed-in account ID, if any
 */
export function isVoteByVoter(vote, voterId, voterName, uid = null) {
  if (uid && vote.uid) return vote.uid === uid;
  if (vote.voterId) return vote.voterId === voterId;
  return vote.voterName === voterName;
}

/**
 * Find a voter's existing vote in a list of votes
 * @param {Array} votes - Array of vote objects
 * @param {string} voterId - Stable per-browser voter ID
 * @param {string} voterName - Voter's display name
 * @param {string|null} uid - Signed-in account ID, if any
 * @returns {Object|undefined} The voter's vote, if any
 */
export function findUserVote(votes, voterId, voterName, uid = null) {
  return votes.find(v => isVoteByVoter(v, voterId, voterName, uid));
}

/**
 * Add a vote to a specific date
 * @param {string} pollId - Poll ID
 * @param {string} dateId - Date ID
 * @param {{id: string, name: string, uid?: string|null}} voter - Voter identity
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
        v => isVoteByVoter(v, voter.id, voter.name, voter.uid ?? null)
      );

      let updatedVotes;
      if (existingVoteIndex !== -1) {
        // Update existing vote (stamping the voter ID onto legacy
        // name-only votes, and the account ID when signed in; a
        // signed-out re-vote keeps the claimed account ID)
        updatedVotes = [...poll.dates[dateIndex].votes];
        const existingUid = voter.uid ?? updatedVotes[existingVoteIndex].uid ?? null;
        updatedVotes[existingVoteIndex] = {
          id: updatedVotes[existingVoteIndex].id,
          voterId: voter.id,
          voterName: voter.name,
          ...(existingUid ? { uid: existingUid } : {}),
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
            ...(voter.uid ? { uid: voter.uid } : {}),
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
 * @param {{id: string, name: string, uid?: string|null}} voter - Commenter identity
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
        ...(voter.uid ? { uid: voter.uid } : {}),
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
 * @param {{id: string, name: string, uid?: string|null}} voter
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
        ...(voter.uid ? { suggestedByUid: voter.uid } : {}),
        votes: [{
          voterId: voter.id,
          voterName: voter.name,
          ...(voter.uid ? { uid: voter.uid } : {})
        }]
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
      const uid = voter.uid ?? null;
      const isMine = (v) => (uid && v.uid ? v.uid === uid : v.voterId === voter.id);
      const hasVoted = game.votes.some(isMine);
      const votes = hasVoted
        ? game.votes.filter(v => !isMine(v))
        : [...game.votes, {
            voterId: voter.id,
            voterName: voter.name,
            ...(uid ? { uid } : {})
          }];

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
export async function removeGame(pollId, auth, gameId) {
  try {
    await runCreatorUpdate(pollId, auth, (poll) => {
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
 * Permanently delete a poll. Only the signed-in owner may do this;
 * the Firestore rules enforce it server-side (request.auth.uid must
 * match the poll's ownerUid), so a browser token is never enough.
 */
export async function deletePoll(pollId, uid) {
  if (!uid) {
    throw appError('errNotCreator', 'Only the signed-in poll owner can delete a poll');
  }
  try {
    await deleteDoc(doc(db, 'polls', pollId));
  } catch (error) {
    console.error('Error deleting poll:', error);
    throw error;
  }
}

/**
 * Attach the signed-in user's account ID to their earlier anonymous
 * activity in a poll: votes, comments and game activity recorded
 * under this browser's voterId get a `uid`, and if this browser
 * holds the poll's creator token and the poll has no owner yet, the
 * account becomes the owner (one-time claim). Safe to call on every
 * visit: it writes nothing when there is nothing to claim.
 * @param {string} pollId
 * @param {{voterId: string, uid: string, creatorToken?: string|null}} identity
 */
export async function claimPollIdentity(pollId, { voterId, uid, creatorToken = null }) {
  if (!uid) return;

  try {
    const pollRef = doc(db, 'polls', pollId);

    await runTransaction(db, async (transaction) => {
      const pollSnap = await transaction.get(pollRef);
      if (!pollSnap.exists()) return;

      const poll = pollSnap.data();
      let changed = false;

      // A record is claimable when it was made by this browser's
      // anonymous ID and no account has claimed it yet
      const claimable = (r) => r.voterId === voterId && !r.uid;

      const dates = poll.dates.map((date) => {
        if (!date.votes.some(claimable) && !(date.comments ?? []).some(claimable)) {
          return date;
        }
        changed = true;
        return {
          ...date,
          votes: date.votes.map(v => (claimable(v) ? { ...v, uid } : v)),
          comments: (date.comments ?? []).map(c => (claimable(c) ? { ...c, uid } : c))
        };
      });

      const games = (poll.games ?? []).map((game) => {
        const claimSuggester = game.suggestedById === voterId && !game.suggestedByUid;
        const claimVotes = game.votes.some(claimable);
        if (!claimSuggester && !claimVotes) return game;
        changed = true;
        return {
          ...game,
          ...(claimSuggester ? { suggestedByUid: uid } : {}),
          votes: game.votes.map(v => (claimable(v) ? { ...v, uid } : v))
        };
      });

      const claimOwnership =
        !poll.ownerUid && !!poll.creatorToken && creatorToken === poll.creatorToken;

      if (!changed && !claimOwnership) return;

      transaction.update(pollRef, {
        ...(changed ? { dates } : {}),
        ...(changed && poll.games ? { games } : {}),
        ...(claimOwnership ? { ownerUid: uid } : {})
      });
    });
  } catch (error) {
    // Claiming is background housekeeping; never break the poll page
    console.error('Error claiming poll identity:', error);
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
