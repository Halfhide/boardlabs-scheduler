import { getBestDates, groupVotesByResponse, getCapacityStatus } from '../../utils/pollHelpers';
import { format, parseISO } from 'date-fns';
import { useTranslation } from '../../i18n/useTranslation';

const RESPONSE_META = [
  { key: 'yes', icon: '✓', badge: 'bg-sage-200 text-sage-800' },
  { key: 'maybe', icon: '?', badge: 'bg-gold-100 text-gold-900' },
  { key: 'no', icon: '✗', badge: 'bg-danger-100 text-danger-800' }
];

const CAPACITY_STYLES = {
  needs: 'bg-gold-100 text-gold-900',
  enough: 'bg-sage-200 text-sage-800',
  full: 'bg-terra-100 text-terra-900'
};

function Results({ dates, finalizedDateId, minPlayers, maxPlayers, onDateClick }) {
  const { t, dateLocale } = useTranslation();
  const bestDates = getBestDates(dates, minPlayers);

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
    <div className="bg-surface rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-ink">{t('resultsHeading')}</h3>
        <p className="text-xs text-neutral-700">
          {t('voters', { count: totalVoters })}
        </p>
      </div>
      <p className="text-xs text-neutral-500 mb-3">
        {t('clickAnyDate')}
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
          const capacity = getCapacityStatus(dateData.votes, minPlayers, maxPlayers);

          return (
            <button
              key={dateData.id}
              type="button"
              onClick={() => onDateClick(dateData)}
              className={`border rounded-md p-2 relative text-left transition-all hover:shadow-md hover:border-terra-400 cursor-pointer ${
                isChosen
                  ? 'border-sage-600 border-2 bg-sage-100'
                  : isBest
                    ? 'border-sage-500 bg-sage-100'
                    : 'border-neutral-300 bg-surface'
              }`}
            >
              {/* Chosen / Best Badge */}
              {isChosen && (
                <div className="absolute -top-1.5 -right-1.5 bg-sage-600 text-ground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {t('chosenBadge')}
                </div>
              )}
              {isBest && (
                <div className="absolute -top-1.5 -right-1.5 bg-sage-600 text-ground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {t('bestBadge')}
                </div>
              )}

              {/* Date */}
              <div className="mb-1.5">
                <div className="text-xs font-semibold text-ink leading-tight">
                  {format(parseISO(dateData.date), t('resultDateFormat'), { locale: dateLocale })}
                </div>
                <div className="text-[10px] text-neutral-600">
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
                        <span className="text-[11px] text-neutral-700 truncate">
                          {votes.map(v => v.voterName).join(', ')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[10px] text-neutral-500 italic">{t('noVotes')}</div>
              )}

              {/* Player capacity state */}
              {capacity && (
                <div className="mt-1">
                  <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${CAPACITY_STYLES[capacity.key]}`}>
                    {t(`capacity${capacity.key.charAt(0).toUpperCase()}${capacity.key.slice(1)}`, { count: capacity.needed })}
                  </span>
                </div>
              )}

              {/* Total votes indicator */}
              {hasVotes && (
                <div className="mt-1 text-[10px] text-neutral-600">
                  {t('votes', { count: totalVotes })}
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
