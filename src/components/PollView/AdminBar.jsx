import { useState } from 'react';

function AdminBar({ poll, onRename, onAddDate, onToggleClosed }) {
  const [titleDraft, setTitleDraft] = useState(poll.title);
  const [newDate, setNewDate] = useState('');
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
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          maxLength={100}
          aria-label="Poll title"
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

      {/* Add date */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          aria-label="New poll date"
          className="flex-1 px-3 py-2 border border-indigo-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          disabled={busy}
        />
        <button
          onClick={() =>
            run(async () => {
              await onAddDate(newDate);
              setNewDate('');
            }, 'Date added')
          }
          disabled={busy || !newDate}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Add date
        </button>
      </div>

      <p className="text-xs text-indigo-700">
        To remove a date, open it in the calendar and use "Remove this date".
      </p>

      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      {notice && <p className="text-xs text-green-700 font-medium">{notice}</p>}
    </div>
  );
}

export default AdminBar;
