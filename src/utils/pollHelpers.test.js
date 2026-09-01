import { describe, it, expect, vi } from 'vitest';

// pollHelpers imports ../firebase, which initializes the live Firebase
// app; the pure functions under test never touch it
vi.mock('../firebase', () => ({ db: {} }));

import {
  MAX_GUESTS,
  voteWeight,
  getVoteSummary,
  getBestDates,
  getCapacityStatus,
  isVoteByVoter,
  findUserVote,
  getLeadingGame,
  groupVotesByResponse
} from './pollHelpers';

const vote = (response, extra = {}) => ({
  id: 'v',
  voterId: 'voter-1',
  voterName: 'Ala',
  response,
  ...extra
});

describe('voteWeight', () => {
  it('counts a plain vote as one player', () => {
    expect(voteWeight(vote('yes'))).toBe(1);
  });

  it('adds the guests the voter brings', () => {
    expect(voteWeight(vote('yes', { guests: 2 }))).toBe(3);
  });

  it('caps guests at MAX_GUESTS', () => {
    expect(voteWeight(vote('yes', { guests: 99 }))).toBe(1 + MAX_GUESTS);
  });

  it('ignores negative and non-integer guest values', () => {
    expect(voteWeight(vote('yes', { guests: -3 }))).toBe(1);
    expect(voteWeight(vote('yes', { guests: 1.5 }))).toBe(1);
    expect(voteWeight(vote('yes', { guests: '2' }))).toBe(1);
  });
});

describe('getVoteSummary', () => {
  it('returns zeros for no votes', () => {
    expect(getVoteSummary([])).toEqual({ yes: 0, no: 0, maybe: 0 });
  });

  it('counts players, not voters', () => {
    const votes = [
      vote('yes', { voterId: 'a', guests: 2 }),
      vote('yes', { voterId: 'b' }),
      vote('maybe', { voterId: 'c', guests: 1 }),
      vote('no', { voterId: 'd' })
    ];
    expect(getVoteSummary(votes)).toEqual({ yes: 4, maybe: 2, no: 1 });
  });
});

describe('getBestDates', () => {
  const date = (id, votes) => ({ id, date: '2026-09-0' + id, votes });

  it('ranks by yes players, then fewer no, then more maybe', () => {
    const dates = [
      date('1', [vote('yes', { voterId: 'a' })]),
      date('2', [vote('yes', { voterId: 'a' }), vote('yes', { voterId: 'b' })]),
      date('3', [vote('yes', { voterId: 'a' }), vote('no', { voterId: 'b' })]),
      date('4', [vote('yes', { voterId: 'a' }), vote('maybe', { voterId: 'b' })])
    ];
    expect(getBestDates(dates).map(d => d.id)).toEqual(['2', '4', '1', '3']);
  });

  it('counts guests toward the yes ranking', () => {
    const dates = [
      date('1', [vote('yes', { voterId: 'a' }), vote('yes', { voterId: 'b' })]),
      date('2', [vote('yes', { voterId: 'a', guests: 2 })])
    ];
    expect(getBestDates(dates).map(d => d.id)).toEqual(['2', '1']);
  });

  it('keeps the yes-count order when minPlayers is set', () => {
    const dates = [
      date('1', [vote('yes', { voterId: 'a', guests: 2 })]),
      date('2', [
        vote('yes', { voterId: 'a', guests: 3 }),
        vote('no', { voterId: 'b' }),
        vote('no', { voterId: 'c' })
      ])
    ];
    // 4 yes players beat 3 whether the viability threshold is met by
    // both (no min), only the leader (min 4), or neither (min 5)
    expect(getBestDates(dates).map(d => d.id)).toEqual(['2', '1']);
    expect(getBestDates(dates, 4).map(d => d.id)).toEqual(['2', '1']);
    expect(getBestDates(dates, 5).map(d => d.id)).toEqual(['2', '1']);
  });

  it('does not mutate the input array', () => {
    const dates = [date('1', []), date('2', [vote('yes')])];
    getBestDates(dates);
    expect(dates.map(d => d.id)).toEqual(['1', '2']);
  });
});

describe('getCapacityStatus', () => {
  it('returns null when the poll has no capacity settings', () => {
    expect(getCapacityStatus([vote('yes')], null, null)).toBeNull();
    expect(getCapacityStatus([vote('yes')], undefined, undefined)).toBeNull();
  });

  it('reports how many more players are needed', () => {
    const votes = [vote('yes', { guests: 1 })];
    expect(getCapacityStatus(votes, 4, null)).toEqual({ key: 'needs', needed: 2 });
  });

  it('reports enough when the minimum is met', () => {
    const votes = [vote('yes', { voterId: 'a', guests: 2 }), vote('yes', { voterId: 'b' })];
    expect(getCapacityStatus(votes, 4, 6)).toEqual({ key: 'enough', needed: 0 });
  });

  it('reports full at the maximum, counting guests', () => {
    const votes = [vote('yes', { voterId: 'a', guests: 3 })];
    expect(getCapacityStatus(votes, null, 4)).toEqual({ key: 'full', needed: 0 });
  });

  it('ignores maybe and no votes for capacity', () => {
    const votes = [vote('maybe', { guests: 5 }), vote('no', { voterId: 'b' })];
    expect(getCapacityStatus(votes, 2, null)).toEqual({ key: 'needs', needed: 2 });
  });
});

describe('isVoteByVoter and findUserVote', () => {
  it('matches by account ID when both sides have one', () => {
    const v = vote('yes', { uid: 'user-A' });
    expect(isVoteByVoter(v, 'other-browser', 'Other', 'user-A')).toBe(true);
    // Same browser, different account: the account wins
    expect(isVoteByVoter(v, 'voter-1', 'Ala', 'user-B')).toBe(false);
  });

  it('matches by voter ID when no account is involved', () => {
    const v = vote('yes');
    expect(isVoteByVoter(v, 'voter-1', 'SomeoneElse')).toBe(true);
    expect(isVoteByVoter(v, 'voter-2', 'Ala')).toBe(false);
  });

  it('falls back to name only for legacy votes without a voter ID', () => {
    const legacy = { voterName: 'Ala', response: 'yes' };
    expect(isVoteByVoter(legacy, 'voter-1', 'Ala')).toBe(true);
    expect(isVoteByVoter(legacy, 'voter-1', 'Ola')).toBe(false);
  });

  it('findUserVote returns the matching vote or undefined', () => {
    const votes = [vote('yes', { voterId: 'a' }), vote('no', { voterId: 'b' })];
    expect(findUserVote(votes, 'b', 'X')).toEqual(votes[1]);
    expect(findUserVote(votes, 'c', 'X')).toBeUndefined();
  });
});

describe('getLeadingGame', () => {
  const game = (id, voteCount) => ({
    id,
    title: 'Game ' + id,
    votes: Array.from({ length: voteCount }, (_, i) => ({ voterId: 'v' + i }))
  });

  it('returns null when there are no games', () => {
    expect(getLeadingGame(null)).toBeNull();
    expect(getLeadingGame([])).toBeNull();
  });

  it('returns the game with the most votes', () => {
    expect(getLeadingGame([game('a', 1), game('b', 3), game('c', 2)]).id).toBe('b');
  });

  it('breaks ties in favor of the earlier suggestion', () => {
    expect(getLeadingGame([game('a', 2), game('b', 2)]).id).toBe('a');
  });
});

describe('groupVotesByResponse', () => {
  it('groups votes and keeps empty groups as arrays', () => {
    const yes = vote('yes', { voterId: 'a' });
    const maybe = vote('maybe', { voterId: 'b' });
    expect(groupVotesByResponse([yes, maybe])).toEqual({
      yes: [yes],
      maybe: [maybe],
      no: []
    });
  });
});
