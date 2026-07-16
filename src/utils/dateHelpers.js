import { format, parseISO, eachDayOfInterval, isValid } from 'date-fns';

/**
 * Format a date string to a readable format
 * @param {string} dateString - ISO date string (YYYY-MM-DD)
 * @param {Object} [options] - date-fns format options (e.g. { locale })
 * @param {string} [pattern] - date-fns format pattern override
 * @returns {string} Formatted date (e.g., "Friday, March 15, 2026")
 */
export function formatDate(dateString, options = {}, pattern = 'EEEE, MMMM d, yyyy') {
  try {
    return format(parseISO(dateString), pattern, options);
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}

/**
 * Generate an array of dates from a start date to an end date
 * @param {string} startDate - ISO date string (YYYY-MM-DD)
 * @param {string} endDate - ISO date string (YYYY-MM-DD)
 * @returns {string[]} Array of ISO date strings
 */
export function generateDateRange(startDate, endDate) {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  if (!isValid(start) || !isValid(end) || start > end) {
    return [];
  }

  // date-fns handles DST transitions correctly, unlike manual
  // setDate() arithmetic which can duplicate or skip days
  return eachDayOfInterval({ start, end }).map(day =>
    format(day, 'yyyy-MM-dd')
  );
}

/**
 * Sort dates in ascending order
 * @param {Array} dates - Array of date objects with 'date' property
 * @returns {Array} Sorted array
 */
export function sortDates(dates) {
  return [...dates].sort((a, b) =>
    parseISO(a.date) - parseISO(b.date)
  );
}
