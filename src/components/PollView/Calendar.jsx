import { useState } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { getVoteSummary, findUserVote } from '../../utils/pollHelpers';
import { useTranslation } from '../../i18n/useTranslation';

// Heatmap shading for group mode, from "few can attend" to "most can
// attend" (static class strings so Tailwind generates them)
const HEAT_BUCKETS = [
  'bg-sage-100 border-sage-300 text-sage-900',
  'bg-sage-200 border-sage-400 text-sage-900',
  'bg-sage-300 border-sage-500 text-sage-900',
  'bg-sage-400 border-sage-600 text-ground',
  'bg-sage-600 border-sage-700 text-ground'
];

const HEAT_ZERO = 'bg-danger-100 border-danger-300 text-danger-800';

function MonthCalendar({ monthDate, dates, voterId, voterName, voterUid, finalizedDateId, mode, totalVoters, onDateClick }) {
  const { t, dateLocale } = useTranslation();
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  // Get all days in the month
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Week layout follows the locale (Sunday-first in English,
  // Monday-first in Polish); pad until the month's first day
  const weekStartsOn = dateLocale.options?.weekStartsOn ?? 0;
  const padding = (monthStart.getDay() - weekStartsOn + 7) % 7;
  const calendarDays = Array(padding).fill(null).concat(daysInMonth);

  const weekDays = t('weekDays').split(',');

  // Check if a date is a poll date
  const isPollDate = (day) => {
    return dates.find(d => isSameDay(parseISO(d.date), day));
  };

  // Get vote summary for a date
  const getDateVotes = (day) => {
    const dateData = dates.find(d => isSameDay(parseISO(d.date), day));
    return dateData ? getVoteSummary(dateData.votes) : null;
  };

  // Get user's vote for a date
  const getUserVote = (day) => {
    const dateData = dates.find(d => isSameDay(parseISO(d.date), day));
    if (!dateData || !voterName) return null;
    const userVote = findUserVote(dateData.votes, voterId, voterName, voterUid);
    return userVote?.response;
  };

  return (
    <div className="flex-1">
      {/* Month Header */}
      <h4 className="text-center font-bold text-ink mb-2 text-sm">
        {format(monthDate, t('monthHeaderFormat'), { locale: dateLocale })}
      </h4>

      {/* Week day headers */}
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map((day, index) => (
          <div key={index} className="text-center text-xs font-semibold text-neutral-600 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day, index) => {
          if (!day) {
            return (
              <div key={`empty-${index}`} className="aspect-square"></div>
            );
          }

          const pollDateData = isPollDate(day);
          const isInCurrentMonth = isSameMonth(day, monthDate);
          const votes = pollDateData ? getDateVotes(day) : null;
          const userVote = getUserVote(day);

          let bgColor = 'bg-surface';
          let borderColor = 'border-neutral-300';
          let textColor = isInCurrentMonth ? 'text-ink' : 'text-neutral-400';
          let hoverEffect = '';

          const totalDateVotes = votes ? votes.yes + votes.maybe + votes.no : 0;

          if (pollDateData) {
            hoverEffect = 'hover:shadow-md hover:scale-110 cursor-pointer transition-all';

            // The chosen date outshines everything else
            if (pollDateData.id === finalizedDateId) {
              bgColor = 'bg-sage-600 ring-2 ring-sage-400 ring-offset-1';
              textColor = 'text-ground';
              borderColor = 'border-sage-700';
            } else if (mode === 'group') {
              // Heatmap: shade by attendance score (yes 1, maybe 0.5)
              if (totalDateVotes === 0 || totalVoters === 0) {
                bgColor = 'bg-terra-100';
                borderColor = 'border-terra-400 border-2';
                textColor = 'text-terra-900';
              } else {
                const score = votes.yes + votes.maybe * 0.5;
                if (score === 0) {
                  [bgColor, borderColor, textColor] = HEAT_ZERO.split(' ');
                } else {
                  const bucket = Math.min(
                    HEAT_BUCKETS.length - 1,
                    Math.floor((score / totalVoters) * HEAT_BUCKETS.length)
                  );
                  [bgColor, borderColor, textColor] = HEAT_BUCKETS[bucket].split(' ');
                }
              }
            } else if (userVote === 'yes') {
              bgColor = 'bg-sage-500';
              textColor = 'text-ground';
              borderColor = 'border-sage-600';
            } else if (userVote === 'maybe') {
              bgColor = 'bg-gold-500';
              textColor = 'text-ink';
              borderColor = 'border-gold-600';
            } else if (userVote === 'no') {
              bgColor = 'bg-danger';
              textColor = 'text-ground';
              borderColor = 'border-danger-600';
            } else {
              bgColor = 'bg-terra-100';
              borderColor = 'border-terra-400 border-2';
              textColor = 'text-terra-900';
            }
          }

          return (
            <button
              key={day.toISOString()}
              onClick={() => pollDateData && onDateClick(pollDateData)}
              disabled={!pollDateData}
              className={`aspect-square border ${borderColor} ${bgColor} ${hoverEffect} p-0.5 relative group rounded-sm`}
            >
              <div className="flex flex-col h-full items-center justify-center">
                <span className={`text-xs font-medium ${textColor}`}>
                  {format(day, 'd')}
                </span>

                {mode === 'group' && pollDateData && totalDateVotes > 0 && (
                  <span className={`text-[8px] leading-none font-semibold ${textColor}`}>
                    {votes.yes}✓
                  </span>
                )}

                {mode === 'mine' && pollDateData && totalDateVotes > 0 && !userVote && (
                  <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-terra rounded-full"></div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Calendar({ dates, voterId, voterName, voterUid, closed, finalizedDateId, onDateClick }) {
  const { t } = useTranslation();
  // 'mine' shows your own votes; 'group' shades dates by how many
  // people can attend
  const [mode, setMode] = useState('mine');

  if (dates.length === 0) {
    return null;
  }

  // Show every month that contains at least one poll date
  const pollDates = dates.map(d => parseISO(d.date)).sort((a, b) => a - b);
  const months = eachMonthOfInterval({
    start: pollDates[0],
    end: pollDates[pollDates.length - 1]
  });

  // Unique voters across the poll (account ID first so one person's
  // votes from two devices count once; voter ID or legacy name after)
  const allVoters = new Set();
  dates.forEach(d => d.votes.forEach(v => allVoters.add(v.uid || v.voterId || v.voterName)));
  const totalVoters = allVoters.size;

  const modeButton = (value) =>
    mode === value
      ? 'bg-terra text-ground'
      : 'bg-surface text-neutral-700 hover:bg-ink/5';

  return (
    <div className="bg-surface rounded-lg shadow-md p-6">
      <h3 className="text-lg font-bold text-ink mb-4 text-center">
        {closed
          ? t('closedClickDetails')
          : t('clickToVote')}
      </h3>

      {/* View mode toggle */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex rounded-full border border-neutral-400 overflow-hidden text-sm font-medium">
          <button
            onClick={() => setMode('mine')}
            className={`px-4 py-1.5 transition-colors ${modeButton('mine')}`}
          >
            {t('myVotes')}
          </button>
          <button
            onClick={() => setMode('group')}
            className={`px-4 py-1.5 border-l border-neutral-400 transition-colors ${modeButton('group')}`}
          >
            {t('groupAvailability')}
          </button>
        </div>
      </div>

      {/* Legend */}
      {mode === 'group' ? (
        <div className="flex gap-3 mb-6 text-xs text-neutral-700 flex-wrap justify-center items-center">
          {finalizedDateId && (
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 bg-sage-600 border border-sage-700 ring-2 ring-sage-400 rounded-sm"></div>
              <span className="font-semibold">{t('chosenDate')}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <span>{t('fewer')}</span>
            <div className="w-4 h-4 bg-sage-100 border border-sage-300 rounded-sm"></div>
            <div className="w-4 h-4 bg-sage-200 border border-sage-400 rounded-sm"></div>
            <div className="w-4 h-4 bg-sage-300 border border-sage-500 rounded-sm"></div>
            <div className="w-4 h-4 bg-sage-400 border border-sage-600 rounded-sm"></div>
            <div className="w-4 h-4 bg-sage-600 border border-sage-700 rounded-sm"></div>
            <span>{t('moreCanAttend')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 bg-danger-100 border border-danger-300 rounded-sm"></div>
            <span>{t('nobodyCan')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 bg-terra-100 border-2 border-terra-400 rounded-sm"></div>
            <span>{t('noVotesYet')}</span>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 mb-6 text-xs text-neutral-700 flex-wrap justify-center">
          {finalizedDateId && (
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 bg-sage-600 border border-sage-700 ring-2 ring-sage-400 rounded-sm"></div>
              <span className="font-semibold">{t('chosenDate')}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 bg-terra-100 border-2 border-terra-400 rounded-sm"></div>
            <span>{t('availableLegend')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 bg-sage-500 border border-sage-600 rounded-sm"></div>
            <span>{t('yes')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 bg-gold-500 border border-gold-600 rounded-sm"></div>
            <span>{t('maybe')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 bg-danger border border-danger-600 rounded-sm"></div>
            <span>{t('no')}</span>
          </div>
        </div>
      )}

      {/* Calendar Grid - one panel per month in the poll range */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {months.map((month) => (
          <MonthCalendar
            key={month.toISOString()}
            monthDate={month}
            dates={dates}
            voterId={voterId}
            voterName={voterName}
            voterUid={voterUid}
            finalizedDateId={finalizedDateId}
            mode={mode}
            totalVoters={totalVoters}
            onDateClick={onDateClick}
          />
        ))}
      </div>
    </div>
  );
}

export default Calendar;
