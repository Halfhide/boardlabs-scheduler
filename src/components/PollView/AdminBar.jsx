import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useTranslation, translateError } from '../../i18n/useTranslation';

function AdminBar({
  poll,
  deadlineDate,
  deadlinePassed,
  finalizedDate,
  onRename,
  onAddDate,
  onToggleClosed,
  onSetDeadline,
  onClearDeadline,
  onSetCapacity,
  onUnfinalize
}) {
  const { t, dateLocale } = useTranslation();
  const [titleDraft, setTitleDraft] = useState(poll.title);
  const [newDate, setNewDate] = useState('');
  const [deadlineDraft, setDeadlineDraft] = useState(
    deadlineDate ? format(deadlineDate, "yyyy-MM-dd'T'HH:mm") : ''
  );
  const [minDraft, setMinDraft] = useState(poll.minPlayers ?? '');
  const [maxDraft, setMaxDraft] = useState(poll.maxPlayers ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const run = async (action, successNotice) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      if (successNotice) setNotice(successNotice);
    } catch (err) {
      console.error('Creator action failed:', err);
      setError(translateError(t, err));
    } finally {
      setBusy(false);
    }
  };

  const trimmedDraft = titleDraft.trim();

  const handleSetDeadline = () =>
    run(async () => {
      const parsed = new Date(deadlineDraft);
      if (isNaN(parsed.getTime())) {
        throw Object.assign(new Error('Invalid date/time'), { code: 'errValidDateTime' });
      }
      if (parsed.getTime() <= Date.now()) {
        throw Object.assign(new Error('Deadline in the past'), { code: 'errDeadlineFuture' });
      }
      await onSetDeadline(parsed);
    }, t('deadlineUpdatedNotice'));

  const handleClearDeadline = () =>
    run(async () => {
      await onClearDeadline();
      setDeadlineDraft('');
    }, t('deadlineRemovedNotice'));

  const handleSaveCapacity = () =>
    run(async () => {
      const parse = (v) => (v === '' ? null : parseInt(v, 10));
      await onSetCapacity(parse(minDraft), parse(maxDraft));
    }, t('capacityUpdatedNotice'));

  const handleClearCapacity = () =>
    run(async () => {
      await onSetCapacity(null, null);
      setMinDraft('');
      setMaxDraft('');
    }, t('capacityRemovedNotice'));

  const hasCapacity = poll.minPlayers != null || poll.maxPlayers != null;

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-indigo-900">
          {t('creatorTools')}
        </h3>
        {!finalizedDate && (
          <button
            onClick={() =>
              run(onToggleClosed, poll.closed ? t('votingReopenedNotice') : t('votingClosedNotice'))
            }
            disabled={busy}
            className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              poll.closed
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-amber-500 text-white hover:bg-amber-600'
            }`}
          >
            {poll.closed ? t('reopenVoting') : t('closeVoting')}
          </button>
        )}
      </div>

      {/* Finalized status */}
      {finalizedDate && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-green-100 border border-green-300 rounded-md px-3 py-2">
          <p className="text-xs text-green-900 font-medium">
            {t('finalizedStatus', {
              date: format(parseISO(finalizedDate.date), t('finalizedDateFormat'), { locale: dateLocale })
            })}
          </p>
          <button
            onClick={() => run(onUnfinalize, t('pollReopenedNotice'))}
            disabled={busy}
            className="text-xs font-medium px-3 py-1.5 rounded-md border border-green-400 text-green-800 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {t('unfinalizeReopen')}
          </button>
        </div>
      )}

      {/* Rename */}
      <div>
        <label htmlFor="admin-title" className="block text-xs font-medium text-indigo-900 mb-1">
          {t('pollTitleLabel')}
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            id="admin-title"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            maxLength={100}
            className="flex-1 px-3 py-2 border border-indigo-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={busy}
          />
          <button
            onClick={() => run(() => onRename(trimmedDraft), t('titleUpdatedNotice'))}
            disabled={busy || !trimmedDraft || trimmedDraft === poll.title}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('renameButton')}
          </button>
        </div>
      </div>

      {/* Add a date option */}
      <div>
        <label htmlFor="admin-new-date" className="block text-xs font-medium text-indigo-900 mb-1">
          {t('addDateLabel')}
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="date"
            id="admin-new-date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="flex-1 px-3 py-2 border border-indigo-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={busy}
          />
          <button
            onClick={() =>
              run(async () => {
                await onAddDate(newDate);
                setNewDate('');
              }, t('dateAddedNotice'))
            }
            disabled={busy || !newDate}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('addDateButton')}
          </button>
        </div>
        <p className="mt-1 text-xs text-indigo-700">
          {t('removeDateHint', { button: t('removeDateButton') })}
        </p>
      </div>

      {/* Voting deadline */}
      <div>
        <label htmlFor="admin-deadline" className="block text-xs font-medium text-indigo-900 mb-1">
          {t('deadlineLabel')}
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="datetime-local"
            id="admin-deadline"
            value={deadlineDraft}
            onChange={(e) => setDeadlineDraft(e.target.value)}
            className="flex-1 px-3 py-2 border border-indigo-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={busy}
          />
          <button
            onClick={handleSetDeadline}
            disabled={busy || !deadlineDraft}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('setDeadline')}
          </button>
          {deadlineDate && (
            <button
              onClick={handleClearDeadline}
              disabled={busy}
              className="px-4 py-2 border border-indigo-300 text-indigo-700 text-sm font-medium rounded-md hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('removeDeadline')}
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-indigo-700">
          {deadlineDate
            ? deadlinePassed
              ? t('deadlinePassedHint', {
                  date: format(deadlineDate, t('deadlineShortFormat'), { locale: dateLocale })
                })
              : t('deadlineClosesHint', {
                  date: format(deadlineDate, t('deadlineShortFormat'), { locale: dateLocale })
                })
            : t('noDeadline')}
        </p>
      </div>

      {/* Player capacity */}
      <div>
        <label htmlFor="admin-min-players" className="block text-xs font-medium text-indigo-900 mb-1">
          {t('capacityLabel')}
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="number"
            id="admin-min-players"
            min={1}
            max={99}
            value={minDraft}
            onChange={(e) => setMinDraft(e.target.value)}
            placeholder={t('minPlaceholder')}
            aria-label={t('minPlayersAria')}
            className="w-full sm:w-24 px-3 py-2 border border-indigo-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={busy}
          />
          <input
            type="number"
            id="admin-max-players"
            min={1}
            max={99}
            value={maxDraft}
            onChange={(e) => setMaxDraft(e.target.value)}
            placeholder={t('maxPlaceholder')}
            aria-label={t('maxPlayersAria')}
            className="w-full sm:w-24 px-3 py-2 border border-indigo-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={busy}
          />
          <button
            onClick={handleSaveCapacity}
            disabled={busy || (minDraft === '' && maxDraft === '')}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('saveCapacity')}
          </button>
          {hasCapacity && (
            <button
              onClick={handleClearCapacity}
              disabled={busy}
              className="px-4 py-2 border border-indigo-300 text-indigo-700 text-sm font-medium rounded-md hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('removeCapacity')}
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-indigo-700">
          {hasCapacity
            ? t('capacityCurrent', {
                min: poll.minPlayers ?? t('noBound'),
                max: poll.maxPlayers ?? t('noBound')
              })
            : t('noCapacity')}
        </p>
      </div>

      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      {notice && <p className="text-xs text-green-700 font-medium">{notice}</p>}
    </div>
  );
}

export default AdminBar;
