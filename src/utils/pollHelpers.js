import { doc, setDoc, runTransaction, deleteField } from 'firebase/firestore';
import { nanoid } from 'nanoid';
import { db } from '../firebase';

// Firestore documents are capped at 1 MB; 92 dates keeps polls well
// under it and matches the create-form range limit
export const MAX_POLL_DATES = 92;

/**
 * Create a new poll
 * @param {string} title - Poll title
 * @param {string[]} dateStrings - Array of ISO date strings
 * @param {Date|null} deadline - Optional voting deadline
 * @returns {Promise<{pollId: string, creatorToken: string}>} Poll ID and creator token
 */
export async function createPoll(title, dateStrings, deadline = null) {
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
      throw new Error('Poll not found');
    }

    const poll = pollSnap.data();

    if (!poll.creatorToken || poll.creatorToken !== creatorToken) {
      throw new Error('Only the poll creator can do this');
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
    throw new Error('Title must be between 1 and 100 characters');
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
    throw new Error('Invalid deadline');
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
    throw new Error('Invalid date');
  }

  try {
    await runCreatorUpdate(pollId, creatorToken, (poll) => {
      if (poll.dates.some(d => d.date === dateString)) {
        throw new Error('That date is already in the poll');
      }
      if (poll.dates.length >= MAX_POLL_DATES) {
        throw new Error(`A poll can have at most ${MAX_POLL_DATES} dates`);
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
 * Remove a date from a poll, including its votes and comments
 * (creator only)
 */
export async function removePollDate(pollId, creatorToken, dateId) {
  try {
    await runCreatorUpdate(pollId, creatorToken, (poll) => {
      if (poll.dates.length <= 1) {
        throw new Error('A poll must keep at least one date');
      }

      const remaining = poll.dates.filter(d => d.id !== dateId);
      if (remaining.length === poll.dates.length) {
        throw new Error('Date not found');
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
        throw new Error('Poll not found');
      }

      const poll = pollSnap.data();
      const dateIndex = poll.dates.findIndex(d => d.id === dateId);

      if (dateIndex === -1) {
        throw new Error('Date not found');
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
        throw new Error('Poll not found');
      }

      const poll = pollSnap.data();
      const dateIndex = poll.dates.findIndex(d => d.id === dateId);

      if (dateIndex === -1) {
        throw new Error('Date not found');
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
 * @returns {Array} Sorted dates (best first)
 */
export function getBestDates(dates) {
  return [...dates].sort((a, b) => {
    const aYes = a.votes.filter(v => v.response === 'yes').length;
    const bYes = b.votes.filter(v => v.response === 'yes').length;

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
