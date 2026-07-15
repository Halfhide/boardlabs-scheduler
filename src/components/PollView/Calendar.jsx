import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { getVoteSummary, findUserVote } from '../../utils/pollHelpers';

function MonthCalendar({ monthDate, dates, voterId, voterName, finalizedDateId, onDateClick }) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  // Get all days in the month
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get day of week for first day (0 = Sunday, 6 = Saturday)
  const firstDayOfWeek = monthStart.getDay();

  // Create array of days with padding for week alignment
  const calendarDays = Array(firstDayOfWeek).fill(null).concat(daysInMonth);

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
        {format(monthDate, 'MMMM yyyy')}
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

          if (pollDateData) {
            hoverEffect = 'hover:shadow-md hover:scale-110 cursor-pointer transition-all';

            // The chosen date outshines everything else
            if (pollDateData.id === finalizedDateId) {
              bgColor = 'bg-green-600 ring-2 ring-green-400 ring-offset-1';
              textColor = 'text-white';
              borderColor = 'border-green-700';
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

                {pollDateData && votes && votes.yes + votes.maybe + votes.no > 0 && !userVote && (
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
  if (dates.length === 0) {
    return null;
  }

  // Show every month that contains at least one poll date
  const pollDates = dates.map(d => parseISO(d.date)).sort((a, b) => a - b);
  const months = eachMonthOfInterval({
    start: pollDates[0],
    end: pollDates[pollDates.length - 1]
  });

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">
        {closed
          ? 'Voting is closed. Click a date to see details'
          : 'Click on any highlighted date to vote'}
      </h3>

      {/* Legend */}
      <div className="flex gap-3 mb-6 text-xs text-gray-600 flex-wrap justify-center">
        {finalizedDateId && (
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 bg-green-600 border border-green-700 ring-2 ring-green-400 rounded-sm"></div>
            <span className="font-semibold">Chosen date</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <div className="w-5 h-5 bg-blue-100 border-2 border-blue-400 rounded-sm"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-5 h-5 bg-green-500 border border-green-600 rounded-sm"></div>
          <span>Yes</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-5 h-5 bg-yellow-400 border border-yellow-500 rounded-sm"></div>
          <span>Maybe</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-5 h-5 bg-red-500 border border-red-600 rounded-sm"></div>
          <span>No</span>
        </div>
      </div>

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
            onDateClick={onDateClick}
          />
        ))}
      </div>
    </div>
  );
}

export default Calendar;
