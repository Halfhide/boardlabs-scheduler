import { useState } from 'react';
import { diceRoll } from '../../utils/diceRoll';

function GameVoting({ games, voterId, voterName, isCreator, closed, onAddGame, onToggleGameVote, onRemoveGame }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmingRemoveId, setConfirmingRemoveId] = useState(null);

  const sorted = [...games].sort(
    (a, b) => b.votes.length - a.votes.length || a.title.localeCompare(b.title)
  );
  const leadingId =
    sorted.length > 0 && sorted[0].votes.length > 0 ? sorted[0].id : null;

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      console.error('Game action failed:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSuggest = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    run(async () => {
      await onAddGame(title, url);
      setTitle('');
      setUrl('');
      diceRoll({ count: 10, origin: { y: 0.6 } });
    });
  };

  const handleRemove = (gameId) => {
    if (confirmingRemoveId !== gameId) {
      setConfirmingRemoveId(gameId);
      return;
    }
    setConfirmingRemoveId(null);
    run(() => onRemoveGame(gameId));
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-gray-900">
          🎲 What shall we play?
        </h3>
        <p className="text-xs text-gray-600">
          {games.length} {games.length === 1 ? 'suggestion' : 'suggestions'}
        </p>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Suggest games and vote for your favorites
      </p>

      {/* Suggestions */}
      {sorted.length > 0 && (
        <ul className="space-y-2 mb-4">
          {sorted.map((game) => {
            const youVoted = game.votes.some((v) => v.voterId === voterId);
            const isLeading = game.id === leadingId;

            return (
              <li
                key={game.id}
                className={`flex items-center gap-3 rounded-md border p-2.5 ${
                  isLeading ? 'border-green-400 bg-green-50' : 'border-gray-200'
                }`}
              >
                <button
                  onClick={() => run(() => onToggleGameVote(game.id))}
                  disabled={busy || closed || !voterName}
                  title={youVoted ? 'Remove your vote' : 'Vote for this game'}
                  className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    youVoted
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-blue-100'
                  }`}
                >
                  👍 {game.votes.length}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {game.url ? (
                      <a
                        href={game.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-700 hover:underline truncate"
                      >
                        {game.title}
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {game.title}
                      </span>
                    )}
                    {isLeading && (
                      <span className="flex-shrink-0 text-[10px] font-bold uppercase bg-green-600 text-white px-1.5 py-0.5 rounded-full">
                        🏆 Leading
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    Suggested by {game.suggestedBy}
                    {game.votes.length > 0 &&
                      ` · ${game.votes.map((v) => v.voterName).join(', ')}`}
                  </p>
                </div>

                {isCreator && (
                  <button
                    onClick={() => handleRemove(game.id)}
                    disabled={busy}
                    className={`flex-shrink-0 text-xs font-medium disabled:opacity-50 ${
                      confirmingRemoveId === game.id
                        ? 'text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded'
                        : 'text-gray-400 hover:text-red-600'
                    }`}
                  >
                    {confirmingRemoveId === game.id ? 'Confirm remove' : '×'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Suggest form */}
      {closed ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
          🔒 Voting is closed, so game suggestions are locked too
        </p>
      ) : voterName ? (
        <form onSubmit={handleSuggest} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="Suggest a game (e.g., Catan)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={busy}
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Link (optional)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Suggest
          </button>
        </form>
      ) : (
        <p className="text-xs text-gray-500 italic">
          Please enter your name at the top of the page to suggest and vote
          on games
        </p>
      )}

      {error && <p className="mt-2 text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}

export default GameVoting;
