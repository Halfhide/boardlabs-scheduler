import { useState, useEffect } from 'react';

/**
 * Current time as a timestamp, refreshed on an interval. Used to
 * re-evaluate time-dependent state (e.g. voting deadlines) while a
 * page stays open.
 * @param {number} intervalMs - Refresh interval in milliseconds
 * @returns {number} Current epoch milliseconds
 */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
