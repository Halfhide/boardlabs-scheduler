import { format, parseISO } from 'date-fns';
import { getVoteSummary } from '../../utils/pollHelpers';
import { useTranslation } from '../../i18n/useTranslation';

const MARK_STYLES = {
  yes: 'bg-green-500 text-white',
  maybe: 'bg-yellow-400 text-white',
  no: 'bg-red-500 text-white'
};

const MARK_LABELS = { yes: '✓', maybe: '?', no: '✗' };

function VoteMatrix({ dates, voterId, voterName, voterUid, finalizedDateId, onDateClick }) {
  const { t, dateLocale } = useTranslation();
  // Collect unique participants (account ID first so one person's
  // votes from two devices share a row, then stable voter ID, name
  // for legacy votes) and index their vote per date
  const participantsByKey = new Map();
  dates.forEach((d) => {
    d.votes.forEach((v) => {
      const key = v.uid || v.voterId || v.voterName;
      if (!participantsByKey.has(key)) {
        participantsByKey.set(key, { key, name: v.voterName, votes: {} });
      }
      const p = participantsByKey.get(key);
      p.name = v.voterName;
      p.votes[d.id] = v.response;
    });
  });

  const isYou = (p) =>
    (voterUid && p.key === voterUid) || p.key === voterId || p.key === voterName;

  // Current user pinned first, everyone else alphabetically
  const participants = [...participantsByKey.values()].sort((a, b) => {
    if (isYou(a) !== isYou(b)) return isYou(a) ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  if (participants.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-gray-900">{t('availabilityTable')}</h3>
        <p className="text-xs text-gray-600">
          {t('participants', { count: participants.length })}
        </p>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        {t('clickColumnHint')}
      </p>

      {/* The table scrolls horizontally inside this card so the page
          itself never scrolls sideways */}
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white z-10 text-left text-xs font-medium text-gray-500 pr-3 align-bottom min-w-28">
                {t('participantHeader')}
              </th>
              {dates.map((d) => {
                const isChosen = d.id === finalizedDateId;
                return (
                  <th key={d.id} className="p-0 align-bottom">
                    <button
                      type="button"
                      onClick={() => onDateClick(d)}
                      className={`w-12 px-1 py-1.5 rounded-md text-center leading-tight hover:bg-blue-100 transition-colors cursor-pointer ${
                        isChosen ? 'bg-green-100 ring-1 ring-green-400' : 'bg-gray-50'
                      }`}
                    >
                      {isChosen && <span className="block text-[10px]">🎉</span>}
                      <span className="block text-[10px] font-medium text-gray-500 uppercase">
                        {format(parseISO(d.date), 'EEE', { locale: dateLocale })}
                      </span>
                      <span className="block text-xs font-semibold text-gray-900 whitespace-nowrap">
                        {format(parseISO(d.date), 'd MMM', { locale: dateLocale })}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Totals row */}
            <tr>
              <th className="sticky left-0 bg-white z-10 text-left text-[11px] font-medium text-gray-500 pr-3">
                {t('canAttend')}
              </th>
              {dates.map((d) => {
                const summary = getVoteSummary(d.votes);
                return (
                  <td key={d.id} className="text-center">
                    <span
                      className={`text-[11px] font-semibold ${
                        summary.yes > 0 ? 'text-green-700' : 'text-gray-400'
                      }`}
                    >
                      {summary.yes}✓
                    </span>
                  </td>
                );
              })}
            </tr>

            {participants.map((p) => {
              const you = isYou(p);
              return (
                <tr key={p.key}>
                  <th
                    className={`sticky left-0 z-10 text-left text-xs font-medium pr-3 py-1 max-w-40 truncate ${
                      you ? 'bg-blue-50 text-blue-900' : 'bg-white text-gray-700'
                    }`}
                  >
                    {p.name}
                    {you && <span className="font-normal text-blue-600"> {t('you')}</span>}
                  </th>
                  {dates.map((d) => {
                    const response = p.votes[d.id];
                    return (
                      <td key={d.id} className="p-0">
                        <div
                          className={`w-12 h-8 flex items-center justify-center rounded text-xs font-bold ${
                            response
                              ? MARK_STYLES[response]
                              : you
                                ? 'bg-blue-50 text-blue-300'
                                : 'bg-gray-100 text-gray-300'
                          }`}
                        >
                          {response ? MARK_LABELS[response] : '·'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default VoteMatrix;
