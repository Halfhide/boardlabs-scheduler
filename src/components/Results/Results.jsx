import { getBestDates, groupVotesByResponse } from '../../utils/pollHelpers';
import { format, parseISO } from 'date-fns';

const RESPONSE_META = [
  { key: 'yes', icon: '✓', badge: 'bg-green-100 text-green-800' },
  { key: 'maybe', icon: '?', badge: 'bg-yellow-100 text-yellow-800' },
  { key: 'no', icon: '✗', badge: 'bg-red-100 text-red-800' }
];

function Results({ dates, finalizedDateId, onDateClick }) {
  const bestDates = getBestDates(dates);

  if (dates.length === 0) {
    return null;
  }

  // Get total unique voters (by stable ID, falling back to name for
  // votes recorded before voter IDs existed)
  const allVoters = new Set();
  dates.forEach(date => {
    date.votes.forEach(vote => {
      allVoters.add(vote.voterId || vote.voterName);
    });
  });

  const totalVoters = allVoters.size;

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-gray-900">Results</h3>
        <p className="text-xs text-gray-600">
          {totalVoters} {totalVoters === 1 ? 'voter' : 'voters'}
        </p>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Click any date to see full details and vote
      </p>

      {/* Grid of Results */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {bestDates.map((dateData, index) => {
          const grouped = groupVotesByResponse(dateData.votes);
          const hasVotes = dateData.votes.length > 0;
          const totalVotes = dateData.votes.length;
          const isChosen = dateData.id === finalizedDateId;
          // Once a date is chosen, the BEST heuristic steps aside
          const isBest = !finalizedDateId && index === 0 && hasVotes;

          return (
            <button
              key={dateData.id}
              type="button"
              onClick={() => onDateClick(dateData)}
              className={`border rounded-md p-2 relative text-left transition-all hover:shadow-md hover:border-blue-400 cursor-pointer ${
                isChosen
                  ? 'border-green-600 border-2 bg-green-50'
                  : isBest
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-200 bg-white'
              }`}
            >
              {/* Chosen / Best Badge */}
              {isChosen && (
                <div className="absolute -top-1.5 -right-1.5 bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  🎉 CHOSEN
                </div>
              )}
              {isBest && (
                <div className="absolute -top-1.5 -right-1.5 bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  🏆 BEST
                </div>
              )}

              {/* Date */}
              <div className="mb-1.5">
                <div className="text-xs font-semibold text-gray-900 leading-tight">
                  {format(parseISO(dateData.date), 'EEE, MMM d')}
                </div>
                <div className="text-[10px] text-gray-500">
                  {format(parseISO(dateData.date), 'yyyy')}
                </div>
              </div>

              {/* Votes with voter names */}
              {hasVotes ? (
                <div className="space-y-1">
                  {RESPONSE_META.map(({ key, icon, badge }) => {
                    const votes = grouped[key];
                    if (votes.length === 0) return null;

                    return (
                      <div key={key} className="flex items-center gap-1 min-w-0">
                        <span className={`flex-shrink-0 inline-flex items-center gap-0.5 ${badge} px-1.5 py-0.5 rounded text-[11px] font-medium`}>
                          <span>{icon}</span>
                          <span>{votes.length}</span>
                        </span>
                        <span className="text-[11px] text-gray-600 truncate">
                          {votes.map(v => v.voterName).join(', ')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[10px] text-gray-400 italic">No votes</div>
              )}

              {/* Total votes indicator */}
              {hasVotes && (
                <div className="mt-1 text-[10px] text-gray-500">
                  {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Results;
