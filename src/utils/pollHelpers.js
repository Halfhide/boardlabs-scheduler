import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { nanoid } from 'nanoid';
import { db } from '../firebase';

/**
 * Create a new poll
 * @param {string} title - Poll title
 * @param {string[]} dateStrings - Array of ISO date strings
 * @returns {Promise<string>} Poll ID
 */
export async function createPoll(title, dateStrings) {
  try {
    const pollId = nanoid(10);
    const pollRef = doc(db, 'polls', pollId);

    const pollData = {
      id: pollId,
      title,
      createdAt: new Date(),
      dates: dateStrings.map((dateString, index) => ({
        id: `date${index}`,
        date: dateString,
        votes: [],
        comments: []
      }))
    };

    await setDoc(pollRef, pollData);
    return pollId;
  } catch (error) {
    console.error('Error creating poll:', error);
    throw error;
  }
}

/**
 * Add a vote to a specific date
 * @param {string} pollId - Poll ID
 * @param {string} dateId - Date ID
 * @param {string} voterName - Voter's name
 * @param {string} response - Vote response ('yes', 'no', or 'maybe')
 */
export async function addVote(pollId, dateId, voterName, response) {
  try {
    const pollRef = doc(db, 'polls', pollId);
    const pollSnap = await getDoc(pollRef);

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
      v => v.voterName === voterName
    );

    let updatedVotes;
    if (existingVoteIndex !== -1) {
      // Update existing vote
      updatedVotes = [...poll.dates[dateIndex].votes];
      updatedVotes[existingVoteIndex] = {
        id: updatedVotes[existingVoteIndex].id,
        voterName,
        response,
        timestamp: new Date()
      };
    } else {
      // Add new vote
      updatedVotes = [
        ...poll.dates[dateIndex].votes,
        {
          id: nanoid(8),
          voterName,
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

    await updateDoc(pollRef, {
      dates: updatedDates
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
 * @param {string} voterName - Commenter's name
 * @param {string} text - Comment text
 */
export async function addComment(pollId, dateId, voterName, text) {
  try {
    const pollRef = doc(db, 'polls', pollId);
    const pollSnap = await getDoc(pollRef);

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
      voterName,
      text,
      timestamp: new Date()
    };

    // Update the entire dates array with new comment
    const updatedDates = [...poll.dates];
    updatedDates[dateIndex] = {
      ...updatedDates[dateIndex],
      comments: [...updatedDates[dateIndex].comments, newComment]
    };

    await updateDoc(pollRef, {
      dates: updatedDates
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
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

    return aNo - bNo;
  });
}
