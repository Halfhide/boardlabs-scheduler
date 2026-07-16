import { useState } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { getVoteSummary, findUserVote } from '../../utils/pollHelpers';
import { useTranslation } from '../../i18n/useTranslation';

// Heatmap shading for group mode, from "few can attend" to "most can
// attend" (static class strings so Tailwind generates them)
const HEAT_BUCKETS = [
  'bg-green-100 border-green-300 text-green-900',
  'bg-green-200 border-green-400 text-green-900',
  'bg-green-300 border-green-500 text-green-900',
  'bg-green-400 border-green-600 text-white',
  'bg-green-600 border-green-700 text-white'
];

const HEAT_ZERO = 'bg-red-100 border-red-300 text-red-900';

function MonthCalendar({ monthDate, dates, voterId, voterName, finalizedDateId, mode, totalVoters, onDateClick }) {
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
    const userVote = findUserVote(dateData.votes, voterId, voterName);
    return userVote?.response;
  };

  return (
    <div className="flex-1">
      {/* Month Header */}
      <h4 className="text-center font-bold text-gray-900 mb-2 text-sm">
        {format(monthDate, t('monthHeaderFormat'), { locale: dateLocale })}
      </h4>

      {/* Week day headers */}
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map((day, index) => (
          <div key={index} className="text-center text-xs font-semibold text-gray-500 py-1">
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

          let bgColor = 'bg-white';
          let borderColor = 'border-gray-200';
          let textColor = isInCurrentMonth ? 'text-gray-900' : 'text-gray-300';
          let hoverEffect = '';

          const totalDateVotes = votes ? votes.yes + votes.maybe + votes.no : 0;

          if (pollDateData) {
            hoverEffect = 'hover:shadow-md hover:scale-110 cursor-pointer transition-all';

            // The chosen date outshines everything else
            if (pollDateData.id === finalizedDateId) {
              bgColor = 'bg-green-600 ring-2 ring-green-400 ring-offset-1';
              textColor = 'text-white';
              borderColor = 'border-green-700';
            } else if (mode === 'group') {
              // Heatmap: shade by attendance score (yes 1, maybe 0.5)
              if (totalDateVotes === 0 || totalVoters === 0) {
                bgColor = 'bg-blue-100';
                borderColor = 'border-blue-400 border-2';
                textColor = 'text-blue-900';
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
              bgColor = 'bg-green-500';
              textColor = 'text-white';
              borderColor = 'border-green-600';
            } else if (userVote === 'maybe') {
              bgColor = 'bg-yellow-400';
              textColor = 'text-white';
              borderColor = 'border-yellow-500';
            } else if (userVote === 'no') {
              bgColor = 'bg-red-500';
              textColor = 'text-white';
              borderColor = 'border-red-600';
            } else {
              bgColor = 'bg-blue-100';
              borderColor = 'border-blue-400 border-2';
              textColor = 'text-blue-900';
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
                  <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Calendar({ dates, voterId, voterName, closed, finalizedDateId, onDateClick }) {
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

  // Unique voters across the poll (by stable ID, name for legacy votes)
  const allVoters = new Set();
  dates.forEach(d => d.votes.forEach(v => allVoters.add(v.voterId || v.voterName)));
  const totalVoters = allVoters.size;

  const modeButton = (value) =>
    mode === value
      ? 'bg-blue-600 text-white'
      : 'bg-white text-gray-600 hover:bg-gray-100';

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">
        {closed
          ? t('closedClickDetails')
          : t('clickToVote')}
      </h3>

      {/* View mode toggle */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden text-sm font-medium">
          <button
            onClick={() => setMode('mine')}
            className={`px-4 py-1.5 transition-colors ${modeButton('mine')}`}
          >
            {t('myVotes')}
          </button>
          <button
            onClick={() => setMode('group')}
            className={`px-4 py-1.5 border-l border-gray-300 transition-colors ${modeButton('group')}`}
          >
            {t('groupAvailability')}
          </button>
        </div>
      </div>

      {/* Legend */}
      {mode === 'group' ? (
        <div className="flex gap-3 mb-6 text-xs text-gray-600 flex-wrap justify-center items-center">
          {finalizedDateId && (
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 bg-green-600 border border-green-700 ring-2 ring-green-400 rounded-sm"></div>
              <span className="font-semibold">{t('chosenDate')}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <span>{t('fewer')}</span>
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded-sm"></div>
            <div className="w-4 h-4 bg-green-200 border border-green-400 rounded-sm"></div>
            <div className="w-4 h-4 bg-green-300 border border-green-500 rounded-sm"></div>
            <div className="w-4 h-4 bg-green-400 border border-green-600 rounded-sm"></div>
            <div className="w-4 h-4 bg-green-600 border border-green-700 rounded-sm"></div>
            <span>{t('moreCanAttend')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 bg-red-100 border border-red-300 rounded-sm"></div>
            <span>{t('nobodyCan')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 bg-blue-100 border-2 border-blue-400 rounded-sm"></div>
            <span>{t('noVotesYet')}</span>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 mb-6 text-xs text-gray-600 flex-wrap justify-center">
          {finalizedDateId && (
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 bg-green-600 border border-green-700 ring-2 ring-green-400 rounded-sm"></div>
              <span className="font-semibold">{t('chosenDate')}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 bg-blue-100 border-2 border-blue-400 rounded-sm"></div>
            <span>{t('availableLegend')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 bg-green-500 border border-green-600 rounded-sm"></div>
            <span>{t('yes')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 bg-yellow-400 border border-yellow-500 rounded-sm"></div>
            <span>{t('maybe')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 bg-red-500 border border-red-600 rounded-sm"></div>
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
