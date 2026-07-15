import { useState, useEffect } from 'react';
import VoteButton from './VoteButton';
import CommentSection from './CommentSection';
import { formatDate } from '../../utils/dateHelpers';
import { getVoteSummary, findUserVote } from '../../utils/pollHelpers';
import confetti from 'canvas-confetti';

function DateModal({ dateData, voterId, voterName, onVote, onComment, onClose }) {
  const [loading, setLoading] = useState(false);
  const [justVoted, setJustVoted] = useState(false);
  const [votingFor, setVotingFor] = useState(null);
  const [voteError, setVoteError] = useState(false);

  // Close on Escape and lock background scroll while the modal is open
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!dateData) return null;

  // Find current user's vote
  const currentUserVote = findUserVote(dateData.votes, voterId, voterName);

  const voteSummary = getVoteSummary(dateData.votes);

  const handleVote = async (response) => {
    if (!voterName) return;

    setLoading(true);
    setVotingFor(response);
    setVoteError(false);

    try {
      await onVote(dateData.id, response);
      setJustVoted(true);

      // 🎊 Different celebrations based on vote type!
      if (response === 'yes') {
        // Green sparkles for YES
        confetti({
          particleCount: 80,
          spread: 60,
          colors: ['#10b981', '#34d399', '#6ee7b7'],
          origin: { y: 0.7 }
        });
      } else if (response === 'maybe') {
        // Yellow stars for MAYBE
        confetti({
          particleCount: 60,
          spread: 50,
          colors: ['#eab308', '#facc15', '#fde047'],
          shapes: ['star'],
          origin: { y: 0.7 }
        });
      } else if (response === 'no') {
        // Subtle red effect for NO
        confetti({
          particleCount: 40,
          spread: 40,
          colors: ['#ef4444', '#f87171'],
          ticks: 100,
          origin: { y: 0.7 }
        });
      }
      // Keep success message visible - don't auto-hide
    } catch (error) {
      console.error('Error voting:', error);
      setVoteError(true);
      setJustVoted(false);
    } finally {
      setLoading(false);
      setVotingFor(null);
    }
  };

  // Show the vote that's being processed, or the actual vote
  const displayedVote = votingFor || currentUserVote?.response;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={formatDate(dateData.date)}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-start">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">
              {formatDate(dateData.date)}
            </h3>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-green-600 font-medium">
                {voteSummary.yes} Yes
              </span>
              <span className="text-yellow-600 font-medium">
                {voteSummary.maybe} Maybe
              </span>
              <span className="text-red-600 font-medium">
                {voteSummary.no} No
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none font-light"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Vote Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold text-gray-900">
                Cast Your Vote
              </h4>
              {currentUserVote && !loading && (
                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  {currentUserVote.response === 'yes' && '✓ You voted Yes'}
                  {currentUserVote.response === 'maybe' && '? You voted Maybe'}
                  {currentUserVote.response === 'no' && '✗ You voted No'}
                </span>
              )}
            </div>

            {/* Instruction Banner */}
            {voterName && !currentUserVote && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-3">
                <p className="text-sm text-blue-800">
                  💡 <strong>Click a button below to vote.</strong> Your vote will be saved immediately.
                </p>
              </div>
            )}

            {/* Error Message */}
            {voteError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-3">
                <p className="text-sm text-red-800 font-medium">
                  Failed to save your vote. Please try again.
                </p>
              </div>
            )}

            {/* Success Message */}
            {justVoted && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-3 animate-bounce-in">
                <p className="text-sm text-green-800 font-medium">
                  ✨ Vote saved! The calendar will update automatically.
                </p>
              </div>
            )}

            {voterName ? (
              <div className="flex gap-2">
                <VoteButton
                  response="yes"
                  currentVote={displayedVote}
                  onClick={handleVote}
                  loading={loading}
                />
                <VoteButton
                  response="maybe"
                  currentVote={displayedVote}
                  onClick={handleVote}
                  loading={loading}
                />
                <VoteButton
                  response="no"
                  currentVote={displayedVote}
                  onClick={handleVote}
                  loading={loading}
                />
              </div>
            ) : (
              <p className="text-sm text-gray-600 italic bg-yellow-50 border border-yellow-200 rounded-md p-3">
                Please enter your name at the top of the page to vote
              </p>
            )}

            {currentUserVote && !loading && !justVoted && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Your vote is shown by the filled button. Click a different button to change it.
              </p>
            )}
          </div>

          {/* Comments Section */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-3">
              Comments ({dateData.comments.length})
            </h4>
            <CommentSection
              comments={dateData.comments}
              dateId={dateData.id}
              voterName={voterName}
              onComment={onComment}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full bg-gray-600 text-white font-medium py-3 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default DateModal;
