import { getBestDates, getVoteSummary } from '../../utils/pollHelpers';
import { format, parseISO } from 'date-fns';

function Results({ dates }) {
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
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-gray-900">Results</h3>
        <p className="text-xs text-gray-600">
          {totalVoters} {totalVoters === 1 ? 'voter' : 'voters'}
        </p>
      </div>

      {/* Grid of Results */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {bestDates.map((dateData, index) => {
          const summary = getVoteSummary(dateData.votes);
          const hasVotes = dateData.votes.length > 0;
          const totalVotes = summary.yes + summary.maybe + summary.no;

          return (
            <div
              key={dateData.id}
              className={`border rounded-md p-2 relative ${
                index === 0 && hasVotes
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {/* Best Badge */}
              {index === 0 && hasVotes && (
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

              {/* Vote Counts */}
              {hasVotes ? (
                <div className="flex gap-1 flex-wrap">
                  {summary.yes > 0 && (
                    <div className="inline-flex items-center gap-0.5 bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-[11px] font-medium">
                      <span>✓</span>
                      <span>{summary.yes}</span>
                    </div>
                  )}
                  {summary.maybe > 0 && (
                    <div className="inline-flex items-center gap-0.5 bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded text-[11px] font-medium">
                      <span>?</span>
                      <span>{summary.maybe}</span>
                    </div>
                  )}
                  {summary.no > 0 && (
                    <div className="inline-flex items-center gap-0.5 bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-[11px] font-medium">
                      <span>✗</span>
                      <span>{summary.no}</span>
                    </div>
                  )}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Results;
