import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPoll, MAX_POLL_DATES } from '../../utils/pollHelpers';
import { generateDateRange } from '../../utils/dateHelpers';
import { rememberPoll } from '../../utils/myPolls';
import { diceRoll } from '../../utils/diceRoll';
import MyPolls from './MyPolls';
import { useTranslation } from '../../i18n/useTranslation';
import { useAuth } from '../../auth/useAuth';

function CreatePoll() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [minPlayers, setMinPlayers] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('');
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
      setError(t('errTitleRequired'));
      return;
    }

    if (!startDate || !endDate) {
      setError(t('errDatesRequired'));
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError(t('errDateOrder'));
      return;
    }

    let deadlineDate = null;
    if (deadline) {
      deadlineDate = new Date(deadline);
      if (isNaN(deadlineDate.getTime()) || deadlineDate.getTime() <= Date.now()) {
        setError(t('errDeadlineFuture'));
        return;
      }
    }

    const parsePlayers = (value) => (value === '' ? null : parseInt(value, 10));
    const min = parsePlayers(minPlayers);
    const max = parsePlayers(maxPlayers);
    const invalidBound = (v) => v !== null && (!Number.isInteger(v) || v < 1 || v > 99);
    if (invalidBound(min) || invalidBound(max)) {
      setError(t('errPlayersRange'));
      return;
    }
    if (min !== null && max !== null && max < min) {
      setError(t('errMaxBelowMin'));
      return;
    }

    setLoading(true);

    try {
      // Generate array of dates
      const dates = generateDateRange(startDate, endDate);

      if (dates.length === 0) {
        setError(t('errNoDates'));
        setLoading(false);
        return;
      }

      if (dates.length > MAX_POLL_DATES) {
        setError(t('errTooManyDatesRange', { count: dates.length, max: MAX_POLL_DATES }));
        setLoading(false);
        return;
      }

      // Create poll in Firebase (a signed-in creator owns it from
      // the start; anonymous creators can claim ownership later)
      const { pollId, creatorToken } = await createPoll(title, dates, {
        deadline: deadlineDate,
        minPlayers: min,
        maxPlayers: max,
        ownerUid: user?.uid ?? null
      });

      // Remember that this browser created the poll, unlocking the
      // creator tools on the poll page
      try {
        localStorage.setItem(`creatorToken:${pollId}`, creatorToken);
      } catch (storageErr) {
        console.error('Could not persist creator token:', storageErr);
      }

      // Add it to this browser's poll list on the homepage
      rememberPoll({ id: pollId, title: title.trim(), createdByMe: true });

      // 🎲 Rolling-dice celebration for creating a poll!
      const duration = 1500;
      const animationEnd = Date.now() + duration;

      function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
      }

      confettiIntervalRef.current = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(confettiIntervalRef.current);
          confettiIntervalRef.current = null;
          // Navigate to the poll page after the dice settle
          navigate(`/poll/${pollId}`);
          return;
        }

        diceRoll({
          count: 5,
          origin: { x: randomInRange(0.1, 0.3), y: randomInRange(0.1, 0.5) }
        });
        diceRoll({
          count: 5,
          origin: { x: randomInRange(0.7, 0.9), y: randomInRange(0.1, 0.5) }
        });
      }, 250);
    } catch (err) {
      console.error('Error creating poll:', err);
      setError(t('errCreateFailed'));
      setLoading(false);
    }
  };

  return (
    <>
    <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {t('createTitle')}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title Input */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            {t('pollTitleLabel')}
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('pollTitlePlaceholder')}
            maxLength={100}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
              {t('startDate')}
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
              {t('endDate')}
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

        {/* Optional Voting Deadline */}
        <div>
          <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-2">
            {t('votingDeadlineLabel')} <span className="text-gray-400 font-normal">{t('optional')}</span>
          </label>
          <input
            type="datetime-local"
            id="deadline"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <p className="mt-1 text-xs text-gray-500">
            {t('deadlineHelp')}
          </p>
        </div>

        {/* Optional Player Capacity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="minPlayers" className="block text-sm font-medium text-gray-700 mb-2">
              {t('minPlayersLabel')} <span className="text-gray-400 font-normal">{t('optional')}</span>
            </label>
            <input
              type="number"
              id="minPlayers"
              min={1}
              max={99}
              value={minPlayers}
              onChange={(e) => setMinPlayers(e.target.value)}
              placeholder={t('minPlayersPlaceholder')}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="maxPlayers" className="block text-sm font-medium text-gray-700 mb-2">
              {t('maxPlayersLabel')} <span className="text-gray-400 font-normal">{t('optional')}</span>
            </label>
            <input
              type="number"
              id="maxPlayers"
              min={1}
              max={99}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
              placeholder={t('maxPlayersPlaceholder')}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>
        </div>
        <p className="-mt-4 text-xs text-gray-500">
          {t('capacityHelp')}
        </p>

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
          {loading ? t('creatingPoll') : t('createPoll')}
        </button>
      </form>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 rounded-md">
        <h3 className="text-sm font-medium text-blue-900 mb-2">{t('howItWorks')}</h3>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>{t('howItWorks1')}</li>
          <li>{t('howItWorks2')}</li>
          <li>{t('howItWorks3')}</li>
          <li>{t('howItWorks4')}</li>
          <li>{t('howItWorks5')}</li>
        </ul>
      </div>
    </div>

    {/* Polls created or visited in this browser */}
    <MyPolls />
    </>
  );
}

export default CreatePoll;
