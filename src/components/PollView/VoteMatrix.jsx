import { format, parseISO } from 'date-fns';
import { getVoteSummary } from '../../utils/pollHelpers';
import { useTranslation } from '../../i18n/useTranslation';

const MARK_STYLES = {
  yes: 'bg-sage-500 text-ground',
  maybe: 'bg-gold-500 text-ink',
  no: 'bg-danger text-ground'
};

const MARK_LABELS = { yes: '✓', maybe: '?', no: '✗' };

function VoteMatrix({ dates, voterId, voterName, voterUid, finalizedDateId, onDateClick }) {
  const { t, dateLocale } = useTranslation();
  // Collect unique participants (account ID first so one person's
  // votes from two devices share a row, then stable voter ID, name
  // for legacy votes) and index their vote per date
  const participantsByKey = new Map();
  // A renamed voter's old votes keep their old name; show the name
  // from their most recent vote so one person reads as one name
  const voteMillis = (v) =>
    v.timestamp?.toMillis ? v.timestamp.toMillis() : (v.timestamp ? +new Date(v.timestamp) : 0);
  dates.forEach((d) => {
    d.votes.forEach((v) => {
      const key = v.uid || v.voterId || v.voterName;
      if (!participantsByKey.has(key)) {
        participantsByKey.set(key, { key, name: v.voterName, nameAt: -1, votes: {} });
      }
      const p = participantsByKey.get(key);
      const at = voteMillis(v);
      if (at >= p.nameAt) {
        p.name = v.voterName;
        p.nameAt = at;
      }
      p.votes[d.id] = { response: v.response, guests: v.guests || 0 };
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
    <div className="bg-surface rounded-lg shadow-md p-4 sm:p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-ink">{t('availabilityTable')}</h3>
        <p className="text-xs text-neutral-700">
          {t('participants', { count: participants.length })}
        </p>
      </div>
      <p className="text-xs text-neutral-500 mb-3">
        {t('clickColumnHint')}
      </p>

      {/* The table scrolls horizontally inside this card so the page
          itself never scrolls sideways */}
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5">
          <thead>
            <tr>
              <th className="sticky left-0 bg-surface z-10 text-left text-xs font-medium text-neutral-600 pr-3 align-bottom min-w-28">
                {t('participantHeader')}
              </th>
              {dates.map((d) => {
                const isChosen = d.id === finalizedDateId;
                return (
                  <th key={d.id} className="p-0 align-bottom">
                    <button
                      type="button"
                      onClick={() => onDateClick(d)}
                      className={`w-12 px-1 py-1.5 rounded-md text-center leading-tight hover:bg-terra-100 transition-colors cursor-pointer ${
                        isChosen ? 'bg-sage-200 ring-1 ring-sage-400' : 'bg-ground'
                      }`}
                    >
                      {isChosen && <span className="block text-[10px]">🎉</span>}
                      <span className="block text-[10px] font-medium text-neutral-600 uppercase">
                        {format(parseISO(d.date), 'EEE', { locale: dateLocale })}
                      </span>
                      <span className="block text-xs font-semibold text-ink whitespace-nowrap">
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
              <th className="sticky left-0 bg-surface z-10 text-left text-[11px] font-medium text-neutral-600 pr-3">
                {t('canAttend')}
              </th>
              {dates.map((d) => {
                const summary = getVoteSummary(d.votes);
                return (
                  <td key={d.id} className="text-center">
                    <span
                      className={`text-[11px] font-semibold ${
                        summary.yes > 0 ? 'text-sage-800' : 'text-neutral-500'
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
                      you ? 'bg-terra-100 text-terra-900' : 'bg-surface text-neutral-800'
                    }`}
                  >
                    {p.name}
                    {you && <span className="font-normal text-terra-700"> {t('you')}</span>}
                  </th>
                  {dates.map((d) => {
                    const cell = p.votes[d.id];
                    return (
                      <td key={d.id} className="p-0">
                        <div
                          className={`w-12 h-8 flex items-center justify-center gap-0.5 rounded text-xs font-bold ${
                            cell
                              ? MARK_STYLES[cell.response]
                              : you
                                ? 'bg-terra-100 text-terra-300'
                                : 'bg-ink/5 text-neutral-400'
                          }`}
                        >
                          {cell ? MARK_LABELS[cell.response] : '·'}
                          {cell && cell.guests > 0 && cell.response !== 'no' && (
                            <span className="text-[9px] font-semibold">+{cell.guests}</span>
                          )}
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
