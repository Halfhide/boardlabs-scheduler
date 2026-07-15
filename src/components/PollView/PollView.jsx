import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { usePoll } from '../../hooks/usePoll';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { addVote, addComment } from '../../utils/pollHelpers';
import { sortDates } from '../../utils/dateHelpers';
import Loading from '../shared/Loading';
import Calendar from './Calendar';
import DateModal from './DateModal';
import Results from '../Results/Results';
import confetti from 'canvas-confetti';

function PollView() {
  const { pollId } = useParams();
  const { poll, loading, error } = usePoll(pollId);
  const [voterName, setVoterName] = useLocalStorage('voterName', '');
  // Stable per-browser voter ID so votes survive renames and two
  // voters with the same name don't overwrite each other
  const [voterId] = useLocalStorage('voterId', nanoid(8));
  const [tempName, setTempName] = useState('');
  const [selectedDateId, setSelectedDateId] = useState(null);
  const [copied, setCopied] = useState(false);

  // Generate shareable link
  const pollUrl = `${window.location.origin}/poll/${pollId}`;

  const handleVote = async (dateId, response) => {
    if (!voterName) return;
    await addVote(pollId, dateId, { id: voterId, name: voterName }, response);
  };

  const handleComment = async (dateId, text) => {
    if (!voterName) return;
    await addComment(pollId, dateId, { id: voterId, name: voterName }, text);
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

      // 🎉 Celebration confetti when name is saved!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  };

  const handleDateClick = (dateData) => {
    setSelectedDateId(dateData.id);
  };

  if (loading) {
    return <Loading message="Loading poll..." />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <h2 className="text-xl font-semibold text-red-900 mb-2">Error</h2>
        <p className="text-red-700">{error}</p>
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

  return (
    <div className="space-y-6">
      {/* Poll Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-3xl font-bold text-gray-900">{poll.title}</h2>

          {/* Subtle Share Button */}
          <button
            onClick={handleCopyLink}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1 rounded-md hover:bg-blue-50 transition-colors"
          >
            {copied ? '✓ Copied!' : '📋 Share Poll'}
          </button>
        </div>
      </div>

      {/* Name Input Section - Prominent and Clear */}
      {!voterName ? (
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-4 sm:p-6 text-white">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-full flex items-center justify-center text-xl sm:text-2xl">
              👤
            </div>
            <div className="flex-1 w-full">
              <h3 className="text-lg sm:text-xl font-bold mb-2">
                Step 1: Enter Your Name
              </h3>
              <p className="text-blue-100 text-sm sm:text-base mb-4">
                Please provide your name to start voting and commenting on dates. This helps everyone see who has voted.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="Enter your name (e.g., John Smith)"
                  className="flex-1 px-4 py-3 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 w-full"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                  }}
                />
                <button
                  onClick={handleSaveName}
                  disabled={!tempName.trim()}
                  className="w-full sm:w-auto px-6 py-3 bg-white text-blue-600 font-semibold rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 animate-bounce-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-lg">
                ✨
              </div>
              <div>
                <p className="text-sm text-green-700 font-medium">
                  You're voting as:
                </p>
                <p className="text-lg font-bold text-green-900">
                  {voterName}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setTempName(voterName);
                setVoterName('');
              }}
              className="text-sm text-green-700 hover:text-green-900 font-medium underline"
            >
              Change Name
            </button>
          </div>
        </div>
      )}

      {/* Calendar View */}
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-4">
          {voterName ? 'Step 2: Click on dates to vote' : 'Available Dates'}
        </h3>
        <Calendar
          dates={sortedDates}
          voterId={voterId}
          voterName={voterName}
          onDateClick={handleDateClick}
        />
      </div>

      {/* Results Summary - Below Calendar */}
      <Results dates={sortedDates} onDateClick={handleDateClick} />

      {/* Date Modal */}
      {selectedDate && (
        <DateModal
          dateData={selectedDate}
          voterId={voterId}
          voterName={voterName}
          onVote={handleVote}
          onComment={handleComment}
          onClose={() => setSelectedDateId(null)}
        />
      )}
    </div>
  );
}

export default PollView;
