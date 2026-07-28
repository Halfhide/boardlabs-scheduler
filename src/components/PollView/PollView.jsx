import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { rememberPoll, forgetPoll } from '../../utils/myPolls';
import { rememberPollForUser, forgetPollForUser } from '../../utils/userPolls';
import { usePoll } from '../../hooks/usePoll';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useNow } from '../../hooks/useNow';
import { format, formatDistanceToNow } from 'date-fns';
import {
  addVote,
  addComment,
  updatePollTitle,
  addPollDate,
  removePollDate,
  setPollClosed,
  setPollDeadline,
  setPollCapacity,
  setFinalizedDate,
  addGame,
  toggleGameVote,
  removeGame,
  claimPollIdentity,
  deletePoll,
  getLeadingGame,
  groupVotesByResponse
} from '../../utils/pollHelpers';
import { useAuth } from '../../auth/useAuth';
import { sortDates, formatDate } from '../../utils/dateHelpers';
import Loading from '../shared/Loading';
import AdminBar from './AdminBar';
import Calendar from './Calendar';
import VoteMatrix from './VoteMatrix';
import GameVoting from './GameVoting';
import DateModal from './DateModal';
import Results from '../Results/Results';
import { diceRoll } from '../../utils/diceRoll';
import { useTranslation } from '../../i18n/useTranslation';

function PollView() {
  const { t, dateLocale } = useTranslation();
  const { pollId } = useParams();
  const navigate = useNavigate();
  const { poll, loading, error } = usePoll(pollId);
  const { user } = useAuth();
  const [voterName, setVoterName] = useLocalStorage('voterName', '');
  // Stable per-browser voter ID so votes survive renames and two
  // voters with the same name don't overwrite each other
  const [voterId] = useLocalStorage('voterId', nanoid(8));
  // Signed-in identity; votes and creator rights follow this across
  // devices while everything keeps working without it
  const voterUid = user?.uid ?? null;
  const [tempName, setTempName] = useState('');
  const [selectedDateId, setSelectedDateId] = useState(null);
  const [copied, setCopied] = useState(false);
  // Ticking clock so a deadline passing while the page is open
  // flips the poll into its closed state
  const now = useNow(30000);

  // Record the visit in this browser's poll list (keeps the title
  // fresh after renames; the created-by-me flag is sticky) and, for
  // signed-in users, in the account's cloud list. The ref keeps the
  // cloud write to real changes instead of every vote snapshot.
  const lastCloudSyncRef = useRef('');
  useEffect(() => {
    if (!poll) return;
    const token = localStorage.getItem(`creatorToken:${poll.id}`);
    const createdByMe =
      (!!poll.creatorToken && token === poll.creatorToken) ||
      (!!voterUid && poll.ownerUid === voterUid);
    rememberPoll({ id: poll.id, title: poll.title, createdByMe });

    if (!voterUid) return;
    const syncKey = `${voterUid}|${poll.id}|${poll.title}|${createdByMe}`;
    if (lastCloudSyncRef.current === syncKey) return;
    lastCloudSyncRef.current = syncKey;
    rememberPollForUser(voterUid, { id: poll.id, title: poll.title, createdByMe });
  }, [poll, voterUid]);

  // Signed-in visitors claim their earlier anonymous activity: votes
  // made under this browser's voterId get the account ID, and a poll
  // created in this browser gets its owner attached (one-time)
  useEffect(() => {
    if (!poll?.id || !voterUid) return;
    const token = localStorage.getItem(`creatorToken:${poll.id}`);
    claimPollIdentity(poll.id, { voterId, uid: voterUid, creatorToken: token });
  }, [poll?.id, voterUid, voterId]);

  // A poll that no longer exists (deleted by its owner) drops out of
  // the remembered lists instead of lingering as a dead link
  useEffect(() => {
    if (error !== 'errPollNotFound' || !pollId) return;
    forgetPoll(pollId);
    if (voterUid) forgetPollForUser(voterUid, pollId);
  }, [error, pollId, voterUid]);

  // Generate shareable link
  const pollUrl = `${window.location.origin}/poll/${pollId}`;

  const handleVote = async (dateId, response) => {
    if (!voterName) return;
    await addVote(pollId, dateId, { id: voterId, name: voterName, uid: voterUid }, response);
  };

  const handleComment = async (dateId, text) => {
    if (!voterName) return;
    await addComment(pollId, dateId, { id: voterId, name: voterName, uid: voterUid }, text);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(pollUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSaveName = () => {
    if (tempName.trim()) {
      setVoterName(tempName.trim());
      setTempName('');

      // 🎲 Celebration dice when name is saved!
      diceRoll({ count: 14, origin: { y: 0.4 } });
    }
  };

  const handleDateClick = (dateData) => {
    setSelectedDateId(dateData.id);
  };

  if (loading) {
    return <Loading message={t('loadingPoll')} />;
  }

  if (error) {
    return (
      <div className="bg-danger-100 border border-danger-200 rounded-lg p-6 text-center">
        <h2 className="text-xl font-semibold text-danger-800 mb-2">{t('errorHeading')}</h2>
        <p className="text-danger-700">{t(error)}</p>
      </div>
    );
  }

  if (!poll) {
    return null;
  }

  const sortedDates = sortDates(poll.dates);

  // Derive the selected date from live poll data so the modal
  // reflects real-time vote and comment updates
  const selectedDate =
    sortedDates.find((d) => d.id === selectedDateId) ?? null;

  // Creator detection mirrors the Firestore rules: an owned poll is
  // managed only by the signed-in owner account; the browser token
  // grants management only while the poll has no owner yet
  const creatorToken = localStorage.getItem(`creatorToken:${pollId}`);
  const isCreator = poll.ownerUid
    ? !!voterUid && poll.ownerUid === voterUid
    : !!poll.creatorToken && creatorToken === poll.creatorToken;
  // Identity handed to creator actions; either credential authorizes
  const creatorAuth = { creatorToken, uid: voterUid };
  // Deletion is stricter than the other creator tools: rules only
  // accept it from the signed-in owner account
  const canDelete = !!voterUid && poll.ownerUid === voterUid;

  const handleDeletePoll = async () => {
    await deletePoll(pollId, voterUid);
    forgetPoll(pollId);
    if (voterUid) forgetPollForUser(voterUid, pollId);
    navigate('/');
  };

  // A poll is closed when the creator closed it, its deadline passed,
  // or a winning date has been finalized
  const deadlineDate = poll.deadline
    ? (poll.deadline.toDate ? poll.deadline.toDate() : new Date(poll.deadline))
    : null;
  const deadlinePassed = !!deadlineDate && deadlineDate.getTime() <= now;
  const finalizedDate = poll.finalizedDateId
    ? sortedDates.find((d) => d.id === poll.finalizedDateId) ?? null
    : null;
  const isClosed = !!poll.closed || deadlinePassed || !!finalizedDate;
  const finalizedVotes = finalizedDate
    ? groupVotesByResponse(finalizedDate.votes)
    : null;
  const games = poll.games ?? [];
  const leadingGame = getLeadingGame(games);

  return (
    <div className="space-y-6">
      {/* Poll Header */}
      <div className="bg-surface rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-3xl font-bold text-ink">{poll.title}</h2>

          {/* Subtle Share Button */}
          <button
            onClick={handleCopyLink}
            className="text-sm text-terra-700 hover:text-terra-800 font-medium px-3 py-1 rounded-full hover:bg-terra/10 transition-colors"
          >
            {copied ? t('copied') : t('sharePoll')}
          </button>
        </div>
      </div>

      {/* Finalized banner - the decision everyone came for */}
      {finalizedDate && (
        <div className="bg-sage-100 border-2 border-sage-500 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <span className="text-3xl">🎉</span>
            <div className="flex-1">
              <p className="text-xl font-bold text-sage-900">
                {t('playingOn', { date: formatDate(finalizedDate.date, { locale: dateLocale }, t('finalizedDateFormat')) })}
              </p>
              <div className="mt-2 space-y-1 text-sm text-sage-900">
                <p>
                  <span className="font-semibold">
                    {t('coming', { count: finalizedVotes.yes.length })}
                  </span>{' '}
                  {finalizedVotes.yes.length > 0
                    ? finalizedVotes.yes.map((v) => v.voterName).join(', ')
                    : t('nobodyYesYet')}
                </p>
                {finalizedVotes.maybe.length > 0 && (
                  <p>
                    <span className="font-semibold">
                      {t('maybeComing', { count: finalizedVotes.maybe.length })}
                    </span>{' '}
                    {finalizedVotes.maybe.map((v) => v.voterName).join(', ')}
                  </p>
                )}
                {leadingGame && leadingGame.votes.length > 0 && (
                  <p>
                    <span className="font-semibold">{t('gameLabel')}</span>{' '}
                    {leadingGame.title} ({t('votes', { count: leadingGame.votes.length })})
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Creator tools */}
      {isCreator && (
        <AdminBar
          poll={poll}
          deadlineDate={deadlineDate}
          deadlinePassed={deadlinePassed}
          finalizedDate={finalizedDate}
          canDelete={canDelete}
          onDelete={handleDeletePoll}
          onRename={(title) => updatePollTitle(pollId, creatorAuth, title)}
          onAddDate={(dateString) => addPollDate(pollId, creatorAuth, dateString)}
          onToggleClosed={() =>
            setPollClosed(pollId, creatorAuth, !poll.closed, poll.closed && deadlinePassed)
          }
          onSetDeadline={(date) => setPollDeadline(pollId, creatorAuth, date)}
          onClearDeadline={() => setPollDeadline(pollId, creatorAuth, null)}
          onSetCapacity={(min, max) => setPollCapacity(pollId, creatorAuth, min, max)}
          onUnfinalize={() => setFinalizedDate(pollId, creatorAuth, null)}
        />
      )}

      {/* Closed banner (the finalized banner already covers closure) */}
      {isClosed && !finalizedDate && (
        <div className="bg-neutral-200 border border-neutral-400 rounded-lg p-4 flex items-center gap-3">
          <span className="text-2xl">🔒</span>
          <div>
            <p className="font-semibold text-ink">{t('votingClosed')}</p>
            <p className="text-sm text-neutral-800">
              {poll.closed
                ? t('closedByCreator')
                : t('closedByDeadline', {
                    date: format(deadlineDate, t('deadlineAtFormat'), { locale: dateLocale })
                  })}{' '}
              {t('browseResults')}
            </p>
          </div>
        </div>
      )}

      {/* Deadline countdown */}
      {!isClosed && deadlineDate && (
        <div className="bg-terra-100 border border-terra-200 rounded-lg p-3 flex items-center gap-2">
          <span className="text-xl">⏳</span>
          <p className="text-sm text-terra-900">
            {t('votingClosesIn', {
              relative: formatDistanceToNow(deadlineDate, { addSuffix: true, locale: dateLocale }),
              date: format(deadlineDate, t('deadlineAtFormat'), { locale: dateLocale })
            })}
          </p>
        </div>
      )}

      {/* Name Input Section - Prominent and Clear */}
      {!voterName ? (
        <div className="bg-gradient-to-r from-terra-500 to-terra-600 rounded-lg shadow-lg p-4 sm:p-6 text-white">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-ground/25 rounded-full flex items-center justify-center text-xl sm:text-2xl">
              👤
            </div>
            <div className="flex-1 w-full">
              <h3 className="text-lg sm:text-xl font-bold mb-2">
                {t('step1Heading')}
              </h3>
              <p className="text-terra-100 text-sm sm:text-base mb-4">
                {t('step1Help')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                  className="flex-1 px-4 py-3 rounded-full bg-ground text-ink placeholder-neutral-500 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-terra-600 w-full"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                  }}
                />
                <button
                  onClick={handleSaveName}
                  disabled={!tempName.trim()}
                  className="w-full sm:w-auto px-6 py-3 bg-ground text-terra-700 font-semibold rounded-full hover:bg-terra-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-terra-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {t('continueButton')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-sage-100 border border-sage-300 rounded-lg p-4 animate-bounce-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sage-200 rounded-full flex items-center justify-center text-lg">
                ✨
              </div>
              <div>
                <p className="text-sm text-sage-800 font-medium">
                  {t('votingAs')}
                </p>
                <p className="text-lg font-bold text-sage-900">
                  {voterName}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setTempName(voterName);
                setVoterName('');
              }}
              className="text-sm text-sage-800 hover:text-sage-900 font-medium underline"
            >
              {t('changeName')}
            </button>
          </div>
        </div>
      )}

      {/* Calendar View */}
      <div>
        <h3 className="text-2xl font-bold text-ink mb-4">
          {isClosed
            ? t('datesAndResults')
            : voterName
              ? t('step2Heading')
              : t('availableDates')}
        </h3>
        <Calendar
          dates={sortedDates}
          voterId={voterId}
          voterName={voterName}
          voterUid={voterUid}
          closed={isClosed}
          finalizedDateId={poll.finalizedDateId ?? null}
          onDateClick={handleDateClick}
        />
      </div>

      {/* Doodle-style availability matrix */}
      <VoteMatrix
        dates={sortedDates}
        voterId={voterId}
        voterName={voterName}
        voterUid={voterUid}
        finalizedDateId={poll.finalizedDateId ?? null}
        onDateClick={handleDateClick}
      />

      {/* Game suggestions and voting */}
      <GameVoting
        games={games}
        voterId={voterId}
        voterName={voterName}
        voterUid={voterUid}
        isCreator={isCreator}
        closed={isClosed}
        onAddGame={(title, url) =>
          addGame(pollId, { id: voterId, name: voterName, uid: voterUid }, title, url)
        }
        onToggleGameVote={(gameId) =>
          toggleGameVote(pollId, gameId, { id: voterId, name: voterName, uid: voterUid })
        }
        onRemoveGame={(gameId) => removeGame(pollId, creatorAuth, gameId)}
      />

      {/* Results Summary - Below Calendar */}
      <Results
        dates={sortedDates}
        finalizedDateId={poll.finalizedDateId ?? null}
        minPlayers={poll.minPlayers ?? null}
        maxPlayers={poll.maxPlayers ?? null}
        onDateClick={handleDateClick}
      />

      {/* Date Modal */}
      {selectedDate && (
        <DateModal
          dateData={selectedDate}
          voterId={voterId}
          voterName={voterName}
          voterUid={voterUid}
          isCreator={isCreator}
          closed={isClosed}
          finalizedDateId={poll.finalizedDateId ?? null}
          minPlayers={poll.minPlayers ?? null}
          maxPlayers={poll.maxPlayers ?? null}
          onVote={handleVote}
          onComment={handleComment}
          onRemoveDate={(dateId) => removePollDate(pollId, creatorAuth, dateId)}
          onFinalize={(dateId) => setFinalizedDate(pollId, creatorAuth, dateId)}
          onClose={() => setSelectedDateId(null)}
        />
      )}
    </div>
  );
}

export default PollView;
