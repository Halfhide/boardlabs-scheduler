import { useCallback, useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { getVoteSummary } from '../../utils/pollHelpers';
import { useTranslation } from '../../i18n/useTranslation';

const MARK_STYLES = {
  yes: 'bg-sage-500 text-ground',
  maybe: 'bg-gold-500 text-ink',
  no: 'bg-danger text-ground'
};

const MARK_LABELS = { yes: '✓', maybe: '?', no: '✗' };

const STATE_KEYS = { yes: 'matrixStateYes', maybe: 'matrixStateMaybe', no: 'matrixStateNo' };

// Tapping your own cell cycles through the answers, Doodle style.
// There is no "remove vote" (the date window has none either), so
// the cycle never returns to empty
const NEXT_RESPONSE = { yes: 'maybe', maybe: 'no', no: 'yes' };

function VoteMatrix({ dates, voterId, voterName, voterUid, finalizedDateId, closed, onDateClick, onVote }) {
  const { t, dateLocale } = useTranslation();

  // Optimistic answers (dateId -> response) shown while a tap is
  // being saved, so fast tapping feels instant
  const [pending, setPending] = useState({});
  const [voteError, setVoteError] = useState(false);
  // Per-date save queue: one write in flight per date, and only the
  // latest wanted answer is sent after it, so rapid taps can't commit
  // out of order
  const saves = useRef({});

  // Horizontal overflow state for the scroll cue
  const scrollRef = useRef(null);
  const [scroll, setScroll] = useState({ left: false, right: false, hidden: 0, nameWidth: 0 });

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const edge = el.scrollLeft + el.clientWidth;
    let hidden = 0;
    el.querySelectorAll('th[data-date]').forEach((th) => {
      if (th.offsetLeft + th.offsetWidth > edge + 1) hidden++;
    });
    const nameWidth = el.querySelector('thead th')?.offsetWidth ?? 0;
    const next = { left: el.scrollLeft > 1, right: el.scrollLeft < max - 1, hidden, nameWidth };
    setScroll((s) =>
      s.left === next.left &&
      s.right === next.right &&
      s.hidden === next.hidden &&
      s.nameWidth === next.nameWidth
        ? s
        : next
    );
  }, []);

  // ResizeObserver reports once on observe, so this also covers the
  // first measurement without a synchronous setState in the effect
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [measure, dates.length]);

  const scrollByPage = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  };

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

  // A named voter who has not voted yet still gets their own (empty)
  // row, so they can start voting straight from the table
  if (voterName && ![...participantsByKey.values()].some(isYou)) {
    const key = voterUid || voterId;
    participantsByKey.set(key, { key, name: voterName, nameAt: -1, votes: {} });
  }

  // Current user pinned first, everyone else alphabetically
  const participants = [...participantsByKey.values()].sort((a, b) => {
    if (isYou(a) !== isYou(b)) return isYou(a) ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  if (participants.length === 0) {
    return null;
  }

  const canVote = !closed && !!voterName && !!onVote;

  const save = async (dateId) => {
    const slot = saves.current[dateId];
    while (slot.sent !== slot.want) {
      const target = slot.want;
      try {
        await onVote(dateId, target);
        slot.sent = target;
      } catch {
        delete saves.current[dateId];
        setVoteError(true);
        setPending((p) => {
          const next = { ...p };
          delete next[dateId];
          return next;
        });
        return;
      }
    }
    delete saves.current[dateId];
    // Let the live snapshot catch up before dropping the optimistic
    // value, so the cell doesn't flash its old state
    setTimeout(() => {
      if (saves.current[dateId]) return;
      setPending((p) => {
        if (!(dateId in p)) return p;
        const next = { ...p };
        delete next[dateId];
        return next;
      });
    }, 1500);
  };

  const handleCellVote = (dateId, current) => {
    const response = current ? NEXT_RESPONSE[current] : 'yes';
    setVoteError(false);
    setPending((p) => ({ ...p, [dateId]: response }));
    const slot = saves.current[dateId];
    if (slot) {
      slot.want = response;
      return;
    }
    saves.current[dateId] = { sent: null, want: response };
    save(dateId);
  };

  const dateLabel = (d) => format(parseISO(d.date), 'EEEE d MMMM', { locale: dateLocale });
  const hint = closed
    ? t('matrixHintClosed')
    : canVote
      ? t('matrixHintVote')
      : t('clickColumnHint');
  const showCue = scroll.left || scroll.right;

  return (
    <div className="bg-surface rounded-lg shadow-md p-4 sm:p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-ink">{t('availabilityTable')}</h3>
        <p className="text-xs text-neutral-700">
          {t('participants', { count: participants.length })}
        </p>
      </div>
      <div className="flex items-end justify-between gap-3 mb-3">
        <p className="text-xs text-neutral-600">{hint}</p>
        {showCue && (
          <div className="flex items-center gap-1.5 shrink-0">
            {scroll.hidden > 0 && (
              <span className="text-xs font-semibold text-terra-700 whitespace-nowrap">
                {t('matrixMoreDays', { count: scroll.hidden })}
              </span>
            )}
            <button
              type="button"
              onClick={() => scrollByPage(-1)}
              disabled={!scroll.left}
              aria-label={t('matrixScrollEarlier')}
              className="relative w-8 h-8 rounded-full border border-neutral-400 text-ink font-bold leading-none hover:bg-ink/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors after:absolute after:-inset-1.5"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => scrollByPage(1)}
              disabled={!scroll.right}
              aria-label={t('matrixScrollLater')}
              className="relative w-8 h-8 rounded-full border border-neutral-400 text-ink font-bold leading-none hover:bg-ink/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors after:absolute after:-inset-1.5"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {voteError && (
        <p role="alert" className="text-sm text-danger-800 bg-danger-100 border border-danger-200 rounded-md px-3 py-2 mb-3">
          {t('voteFailed')}
        </p>
      )}

      {/* The table scrolls horizontally inside this card so the page
          itself never scrolls sideways; the fade and the arrows above
          show that more days are hidden (macOS hides scrollbars) */}
      <div className="relative">
        <div ref={scrollRef} onScroll={measure} className="overflow-x-auto">
          <table className="border-separate border-spacing-0.5">
            <thead>
              <tr>
                <th className="sticky left-0 bg-surface z-10 text-left text-xs font-medium text-neutral-600 pr-2 align-bottom min-w-20 sm:min-w-24">
                  {t('participantHeader')}
                </th>
                {dates.map((d) => {
                  const isChosen = d.id === finalizedDateId;
                  return (
                    <th key={d.id} data-date className="p-0 align-bottom">
                      <button
                        type="button"
                        onClick={() => onDateClick(d)}
                        aria-label={dateLabel(d)}
                        className={`w-8 py-1 rounded-md text-center leading-tight hover:bg-terra-100 transition-colors cursor-pointer ${
                          isChosen ? 'bg-sage-200 ring-1 ring-sage-400' : 'bg-ground'
                        }`}
                      >
                        {isChosen && <span className="block text-[10px]">🎉</span>}
                        <span className="block text-[9px] font-medium text-neutral-600 uppercase">
                          {format(parseISO(d.date), 'EEEEEE', { locale: dateLocale })}
                        </span>
                        <span className="block text-sm font-bold text-ink">
                          {format(parseISO(d.date), 'd', { locale: dateLocale })}
                        </span>
                        <span className="block text-[9px] font-medium text-neutral-600">
                          {format(parseISO(d.date), 'LLL', { locale: dateLocale })}
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
                <th className="sticky left-0 bg-surface z-10 text-left text-[11px] font-medium text-neutral-600 pr-2">
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
                const votable = you && canVote;
                return (
                  <tr key={p.key}>
                    <th
                      title={p.name}
                      className={`sticky left-0 z-10 text-left text-xs font-medium pr-2 py-1 max-w-24 truncate ${
                        you ? 'bg-terra-100 text-terra-900' : 'bg-surface text-neutral-800'
                      }`}
                    >
                      {p.name}
                      {you && <span className="font-normal text-terra-700"> {t('you')}</span>}
                    </th>
                    {dates.map((d) => {
                      const saved = p.votes[d.id];
                      const response = (you && pending[d.id]) || saved?.response;
                      const guests = saved && response !== 'no' ? saved.guests : 0;
                      const state = t(response ? STATE_KEYS[response] : 'matrixStateNone');
                      return (
                        <td key={d.id} className="p-0">
                          <button
                            type="button"
                            onClick={() =>
                              votable ? handleCellVote(d.id, response) : onDateClick(d)
                            }
                            aria-label={
                              votable
                                ? t('matrixCellVoteAria', { date: dateLabel(d), state })
                                : t('matrixCellAria', { date: dateLabel(d), name: p.name, state })
                            }
                            className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold transition-colors ${
                              response
                                ? MARK_STYLES[response]
                                : you
                                  ? 'bg-terra-100 text-terra-300'
                                  : 'bg-ink/5 text-neutral-400'
                            } ${
                              votable
                                ? 'cursor-pointer hover:ring-2 hover:ring-terra-400'
                                : 'cursor-pointer hover:ring-1 hover:ring-neutral-400'
                            }`}
                          >
                            {response ? MARK_LABELS[response] : '·'}
                            {guests > 0 && (
                              <span className="text-[9px] font-semibold">+{guests}</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Columns sliding under the sticky name column fade out too */}
        {scroll.left && (
          <div
            className="pointer-events-none absolute inset-y-0 w-6 bg-linear-to-r from-surface to-transparent z-20"
            style={{ left: scroll.nameWidth }}
          />
        )}
        {scroll.right && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-surface to-transparent" />
        )}
      </div>
    </div>
  );
}

export default VoteMatrix;
