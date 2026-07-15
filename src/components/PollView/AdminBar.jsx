import { useState } from 'react';
import { format } from 'date-fns';

function AdminBar({
  poll,
  deadlineDate,
  deadlinePassed,
  onRename,
  onAddDate,
  onToggleClosed,
  onSetDeadline,
  onClearDeadline
}) {
  const [titleDraft, setTitleDraft] = useState(poll.title);
  const [newDate, setNewDate] = useState('');
  const [deadlineDraft, setDeadlineDraft] = useState(
    deadlineDate ? format(deadlineDate, "yyyy-MM-dd'T'HH:mm") : ''
  );
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
      setError(err.message || 'Action failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const trimmedDraft = titleDraft.trim();

  const handleSetDeadline = () =>
    run(async () => {
      const parsed = new Date(deadlineDraft);
      if (isNaN(parsed.getTime())) {
        throw new Error('Please pick a valid date and time');
      }
      if (parsed.getTime() <= Date.now()) {
        throw new Error('The deadline must be in the future');
      }
      await onSetDeadline(parsed);
    }, 'Deadline updated');

  const handleClearDeadline = () =>
    run(async () => {
      await onClearDeadline();
      setDeadlineDraft('');
    }, 'Deadline removed');

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-indigo-900">
          🛠️ Creator tools
        </h3>
        <button
          onClick={() =>
            run(onToggleClosed, poll.closed ? 'Voting reopened' : 'Voting closed')
          }
          disabled={busy}
          className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            poll.closed
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-amber-500 text-white hover:bg-amber-600'
          }`}
        >
          {poll.closed ? 'Reopen voting' : 'Close voting'}
        </button>
      </div>

      {/* Rename */}
      <div>
        <label htmlFor="admin-title" className="block text-xs font-medium text-indigo-900 mb-1">
          Poll title
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
            onClick={() => run(() => onRename(trimmedDraft), 'Title updated')}
            disabled={busy || !trimmedDraft || trimmedDraft === poll.title}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Rename
          </button>
        </div>
      </div>

      {/* Add a date option */}
      <div>
        <label htmlFor="admin-new-date" className="block text-xs font-medium text-indigo-900 mb-1">
          Add another date option for participants to vote on
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
              }, 'Date option added to the poll')
            }
            disabled={busy || !newDate}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add date option
          </button>
        </div>
        <p className="mt-1 text-xs text-indigo-700">
          To remove a date option, open it in the calendar and use "Remove
          this date from the poll".
        </p>
      </div>

      {/* Voting deadline */}
      <div>
        <label htmlFor="admin-deadline" className="block text-xs font-medium text-indigo-900 mb-1">
          Voting deadline (voting closes automatically at this time)
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
            Set deadline
          </button>
          {deadlineDate && (
            <button
              onClick={handleClearDeadline}
              disabled={busy}
              className="px-4 py-2 border border-indigo-300 text-indigo-700 text-sm font-medium rounded-md hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Remove deadline
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-indigo-700">
          {deadlineDate
            ? deadlinePassed
              ? `The deadline (${format(deadlineDate, 'MMM d, HH:mm')}) has passed and voting is closed. Change or remove it to reopen.`
              : `Voting closes ${format(deadlineDate, 'MMM d, HH:mm')}.`
            : 'No voting deadline set.'}
        </p>
      </div>

      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      {notice && <p className="text-xs text-green-700 font-medium">{notice}</p>}
    </div>
  );
}

export default AdminBar;
