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
  // Errors are i18n keys, translated where they are rendered
  const [error, setError] = useState(!pollId ? 'errNoPollId' : null);
  const [prevPollId, setPrevPollId] = useState(pollId);

  // Reset state during render when the poll ID changes, so a stale
  // poll is never shown while the new one is loading
  if (prevPollId !== pollId) {
    setPrevPollId(pollId);
    setPoll(null);
    setLoading(!!pollId);
    setError(!pollId ? 'errNoPollId' : null);
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
          setError('errPollNotFound');
          setPoll(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching poll:', err);
        setError('errLoadPoll');
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [pollId]);

  return { poll, loading, error };
}
