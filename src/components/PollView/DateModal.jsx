import { useState, useEffect } from 'react';
import VoteButton from './VoteButton';
import VoterBreakdown from './VoterBreakdown';
import CommentSection from './CommentSection';
import { formatDate } from '../../utils/dateHelpers';
import { getVoteSummary, findUserVote, getCapacityStatus } from '../../utils/pollHelpers';
import { diceRoll } from '../../utils/diceRoll';
import { useTranslation, translateError } from '../../i18n/useTranslation';

const CAPACITY_STYLES = {
  needs: 'bg-gold-100 text-gold-900',
  enough: 'bg-sage-200 text-sage-800',
  full: 'bg-terra-100 text-terra-900'
};

function DateModal({ dateData, voterId, voterName, voterUid, isCreator, closed, finalizedDateId, minPlayers, maxPlayers, onVote, onComment, onRemoveDate, onFinalize, onClose }) {
  const { t, dateLocale } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [justVoted, setJustVoted] = useState(false);
  const [votingFor, setVotingFor] = useState(null);
  const [voteError, setVoteError] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');

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
  const currentUserVote = findUserVote(dateData.votes, voterId, voterName, voterUid);

  const voteSummary = getVoteSummary(dateData.votes);
  const capacity = getCapacityStatus(dateData.votes, minPlayers, maxPlayers);

  const handleVote = async (response) => {
    if (!voterName) return;

    setLoading(true);
    setVotingFor(response);
    setVoteError(false);

    try {
      await onVote(dateData.id, response);
      setJustVoted(true);

      // 🎲 Rolling dice, sized by how enthusiastic the vote is
      if (response === 'yes') {
        diceRoll({ count: 14, origin: { y: 0.55 } });
      } else if (response === 'maybe') {
        diceRoll({ count: 8, origin: { y: 0.55 } });
      } else if (response === 'no') {
        diceRoll({ count: 4, origin: { y: 0.55 } });
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

  const isFinalizedDate = finalizedDateId === dateData.id;

  const handleFinalize = async () => {
    setFinalizing(true);
    setFinalizeError('');
    try {
      await onFinalize(isFinalizedDate ? null : dateData.id);
      // 🎲 Big dice roll when a date is chosen!
      if (!isFinalizedDate) {
        diceRoll({ count: 26, origin: { y: 0.5 } });
      }
    } catch (error) {
      console.error('Error finalizing date:', error);
      setFinalizeError(translateError(t, error, 'errFinalizeFailed'));
    } finally {
      setFinalizing(false);
    }
  };

  // Two-step removal instead of a native confirm dialog
  const handleRemoveDate = async () => {
    if (!confirmingRemove) {
      setConfirmingRemove(true);
      return;
    }

    setRemoving(true);
    setRemoveError(false);
    try {
      await onRemoveDate(dateData.id);
      onClose();
    } catch (error) {
      console.error('Error removing date:', error);
      setRemoveError(true);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-surface rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={formatDate(dateData.date, { locale: dateLocale }, t('finalizedDateFormat'))}
      >
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-neutral-300 px-6 py-4 flex justify-between items-start">
          <div>
            <h3 className="text-2xl font-bold text-ink">
              {formatDate(dateData.date, { locale: dateLocale }, t('finalizedDateFormat'))}
            </h3>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-sage-700 font-medium">
                {t('yesCount', { count: voteSummary.yes })}
              </span>
              <span className="text-gold-600 font-medium">
                {t('maybeCount', { count: voteSummary.maybe })}
              </span>
              <span className="text-danger-600 font-medium">
                {t('noCount', { count: voteSummary.no })}
              </span>
              {capacity && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full self-center ${CAPACITY_STYLES[capacity.key]}`}>
                  {t(`capacity${capacity.key.charAt(0).toUpperCase()}${capacity.key.slice(1)}`, { count: capacity.needed })}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 text-3xl leading-none font-light"
            aria-label={t('closeButton')}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Vote Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold text-ink">
                {t('castYourVote')}
              </h4>
              {currentUserVote && !loading && (
                <span className="text-sm text-neutral-700 bg-ink/5 px-3 py-1 rounded-full">
                  {currentUserVote.response === 'yes' && t('youVotedYes')}
                  {currentUserVote.response === 'maybe' && t('youVotedMaybe')}
                  {currentUserVote.response === 'no' && t('youVotedNo')}
                </span>
              )}
            </div>

            {/* Instruction Banner */}
            {voterName && !currentUserVote && !closed && (
              <div className="bg-terra-100 border border-terra-200 rounded-md p-3 mb-3">
                <p className="text-sm text-terra-800">
                  💡 <strong>{t('clickButtonBelow')}</strong> {t('savedImmediately')}
                </p>
              </div>
            )}

            {/* Error Message */}
            {voteError && (
              <div className="bg-danger-100 border border-danger-200 rounded-md p-3 mb-3">
                <p className="text-sm text-danger-800 font-medium">
                  {t('voteFailed')}
                </p>
              </div>
            )}

            {/* Success Message */}
            {justVoted && (
              <div className="bg-sage-100 border border-sage-300 rounded-md p-3 mb-3 animate-bounce-in">
                <p className="text-sm text-sage-800 font-medium">
                  {t('voteSaved')}
                </p>
              </div>
            )}

            {closed ? (
              <p className="text-sm text-neutral-800 bg-neutral-200 border border-neutral-400 rounded-md p-3">
                {t('votingClosedForPoll')}
              </p>
            ) : voterName ? (
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
              <p className="text-sm text-neutral-700 italic bg-gold-100 border border-gold-200 rounded-md p-3">
                {t('enterNameToVote')}
              </p>
            )}

            {currentUserVote && !loading && !justVoted && (
              <p className="text-xs text-neutral-600 mt-2 text-center">
                {t('changeVoteHint')}
              </p>
            )}
          </div>

          {/* Voter Breakdown - who you'd be playing with */}
          <div>
            <h4 className="text-lg font-semibold text-ink mb-3">
              {t('whosVoted', { count: dateData.votes.length })}
            </h4>
            <VoterBreakdown
              votes={dateData.votes}
              voterId={voterId}
              voterUid={voterUid}
              voterName={voterName}
            />
          </div>

          {/* Comments Section */}
          <div>
            <h4 className="text-lg font-semibold text-ink mb-3">
              {t('commentsHeading', { count: dateData.comments.length })}
            </h4>
            <CommentSection
              comments={dateData.comments}
              dateId={dateData.id}
              voterName={voterName}
              onComment={onComment}
            />
          </div>

          {/* Creator actions */}
          {isCreator && (
            <div className="border-t border-neutral-300 pt-4 space-y-3">
              <button
                onClick={handleFinalize}
                disabled={finalizing || removing}
                className={`w-full py-2.5 px-4 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isFinalizedDate
                    ? 'border border-sage-500 text-sage-800 hover:bg-sage-100'
                    : 'bg-sage-600 text-ground hover:bg-sage-700'
                }`}
              >
                {finalizing
                  ? t('saving')
                  : isFinalizedDate
                    ? t('unfinalizeButton')
                    : t('finalizeButton')}
              </button>
              {finalizeError && (
                <p className="text-xs text-danger-600">{finalizeError}</p>
              )}
              <button
                onClick={handleRemoveDate}
                disabled={removing}
                className={`text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                  confirmingRemove
                    ? 'text-ground bg-danger-600 hover:bg-danger-700 px-4 py-2 rounded-full'
                    : 'text-danger-600 hover:text-danger-700'
                }`}
              >
                {removing
                  ? t('removingEllipsis')
                  : confirmingRemove
                    ? t('confirmRemoveDate')
                    : t('removeDateButton')}
              </button>
              {confirmingRemove && !removing && (
                <p className="text-xs text-neutral-600 mt-1">
                  {t('removeDateWarning')}
                </p>
              )}
              {removeError && (
                <p className="text-xs text-danger-600 mt-1">
                  {t('removeDateFailed')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-ground border-t border-neutral-300 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full bg-neutral-700 text-ground font-medium py-3 px-4 rounded-full hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-600 focus:ring-offset-2 transition-colors"
          >
            {t('closeButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DateModal;
