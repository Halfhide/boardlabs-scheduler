import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Custom hook to fetch and listen to poll data in real-time
 * @param {string} pollId - Poll ID to fetch
 * @returns {Object} Poll data, loading state, and error state
 */
export function usePoll(pollId) {
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(!!pollId);
  const [error, setError] = useState(!pollId ? 'No poll ID provided' : null);
  const [prevPollId, setPrevPollId] = useState(pollId);

  // Reset state during render when the poll ID changes, so a stale
  // poll is never shown while the new one is loading
  if (prevPollId !== pollId) {
    setPrevPollId(pollId);
    setPoll(null);
    setLoading(!!pollId);
    setError(!pollId ? 'No poll ID provided' : null);
  }

  useEffect(() => {
    if (!pollId) {
      return;
    }

    const pollRef = doc(db, 'polls', pollId);

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      pollRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setPoll({ id: snapshot.id, ...snapshot.data() });
          setError(null);
        } else {
          setError('Poll not found');
          setPoll(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching poll:', err);
        setError('Failed to load poll. Please try again.');
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [pollId]);

  return { poll, loading, error };
}
