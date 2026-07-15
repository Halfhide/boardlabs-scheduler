import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPoll, MAX_POLL_DATES } from '../../utils/pollHelpers';
import { generateDateRange } from '../../utils/dateHelpers';
import confetti from 'canvas-confetti';

function CreatePoll() {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const confettiIntervalRef = useRef(null);

  // Stop the fireworks (and the delayed navigation) if the user
  // leaves the page before the animation finishes
  useEffect(() => {
    return () => {
      if (confettiIntervalRef.current) {
        clearInterval(confettiIntervalRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!title.trim()) {
      setError('Please enter a poll title');
      return;
    }

    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be before or equal to end date');
      return;
    }

    setLoading(true);

    try {
      // Generate array of dates
      const dates = generateDateRange(startDate, endDate);

      if (dates.length === 0) {
        setError('No dates generated. Please check your date range.');
        setLoading(false);
        return;
      }

      if (dates.length > MAX_POLL_DATES) {
        setError(`Date range is too long (${dates.length} days). Please choose a range of ${MAX_POLL_DATES} days or less.`);
        setLoading(false);
        return;
      }

      // Create poll in Firebase
      const { pollId, creatorToken } = await createPoll(title, dates);

      // Remember that this browser created the poll, unlocking the
      // creator tools on the poll page
      try {
        localStorage.setItem(`creatorToken:${pollId}`, creatorToken);
      } catch (storageErr) {
        console.error('Could not persist creator token:', storageErr);
      }

      // 🎆 Fireworks celebration for creating a poll!
      const duration = 1500;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
      }

      confettiIntervalRef.current = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(confettiIntervalRef.current);
          confettiIntervalRef.current = null;
          // Navigate to the poll page after fireworks
          navigate(`/poll/${pollId}`);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);
    } catch (err) {
      console.error('Error creating poll:', err);
      setError('Failed to create poll. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Create a New Poll
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title Input */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Poll Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Board Game Night - January"
            maxLength={100}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-medium py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creating Poll...' : 'Create Poll'}
        </button>
      </form>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 rounded-md">
        <h3 className="text-sm font-medium text-blue-900 mb-2">How it works:</h3>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Enter a title for your poll</li>
          <li>Select a date range for possible meeting dates</li>
          <li>Share the generated link with participants</li>
          <li>Everyone votes YES/NO/MAYBE on each date</li>
          <li>See results in real-time!</li>
        </ul>
      </div>
    </div>
  );
}

export default CreatePoll;
