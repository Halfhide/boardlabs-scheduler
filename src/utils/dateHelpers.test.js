import { describe, it, expect } from 'vitest';
import { formatDate, generateDateRange, sortDates } from './dateHelpers';

describe('generateDateRange', () => {
  it('returns every day of the range, inclusive', () => {
    expect(generateDateRange('2026-09-04', '2026-09-06')).toEqual([
      '2026-09-04',
      '2026-09-05',
      '2026-09-06'
    ]);
  });

  it('returns a single day when start equals end', () => {
    expect(generateDateRange('2026-09-04', '2026-09-04')).toEqual(['2026-09-04']);
  });

  it('returns empty for a reversed range', () => {
    expect(generateDateRange('2026-09-06', '2026-09-04')).toEqual([]);
  });

  it('returns empty for invalid input', () => {
    expect(generateDateRange('nonsense', '2026-09-04')).toEqual([]);
    expect(generateDateRange('2026-09-04', '')).toEqual([]);
  });

  it('produces one entry per day across DST transitions', () => {
    // Europe springs forward on 29 Mar 2026 and falls back on 25 Oct
    expect(generateDateRange('2026-03-28', '2026-03-30')).toEqual([
      '2026-03-28',
      '2026-03-29',
      '2026-03-30'
    ]);
    expect(generateDateRange('2026-10-24', '2026-10-26')).toEqual([
      '2026-10-24',
      '2026-10-25',
      '2026-10-26'
    ]);
  });
});

describe('formatDate', () => {
  it('formats with the default pattern', () => {
    expect(formatDate('2026-09-04')).toBe('Friday, September 4, 2026');
  });

  it('accepts a pattern override', () => {
    expect(formatDate('2026-09-04', {}, 'yyyy/MM/dd')).toBe('2026/09/04');
  });

  it('returns the input unchanged when it cannot be parsed', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('sortDates', () => {
  it('sorts by date ascending without mutating the input', () => {
    const input = [{ date: '2026-09-06' }, { date: '2026-09-04' }, { date: '2026-09-05' }];
    expect(sortDates(input).map(d => d.date)).toEqual([
      '2026-09-04',
      '2026-09-05',
      '2026-09-06'
    ]);
    expect(input[0].date).toBe('2026-09-06');
  });
});
