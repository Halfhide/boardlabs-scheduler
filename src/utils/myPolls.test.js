import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getMyPolls, rememberPoll, forgetPoll } from './myPolls';

// Tests run in Node, where window does not exist; give the module a
// minimal localStorage. The module's own try/catch guards cover real
// browsers with storage disabled.
function makeStorage() {
  let store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    corrupt: () => {
      store.myPolls = '{not json';
    }
  };
}

let storage;

beforeEach(() => {
  storage = makeStorage();
  vi.stubGlobal('window', { localStorage: storage });
});

describe('getMyPolls', () => {
  it('returns an empty list when nothing is stored', () => {
    expect(getMyPolls()).toEqual([]);
  });

  it('returns an empty list for corrupted storage', () => {
    storage.corrupt();
    expect(getMyPolls()).toEqual([]);
  });

  it('returns an empty list when window is missing entirely', () => {
    vi.stubGlobal('window', undefined);
    expect(getMyPolls()).toEqual([]);
  });
});

describe('rememberPoll', () => {
  it('adds new polls newest first', () => {
    rememberPoll({ id: 'p1', title: 'First' });
    rememberPoll({ id: 'p2', title: 'Second' });
    expect(getMyPolls().map(p => p.id)).toEqual(['p2', 'p1']);
  });

  it('ignores entries without id or title', () => {
    rememberPoll({ id: '', title: 'X' });
    rememberPoll({ id: 'p1', title: '' });
    expect(getMyPolls()).toEqual([]);
  });

  it('bumps a revisited poll to the top with the fresh title', () => {
    rememberPoll({ id: 'p1', title: 'Old name' });
    rememberPoll({ id: 'p2', title: 'Other' });
    rememberPoll({ id: 'p1', title: 'New name' });

    const list = getMyPolls();
    expect(list.map(p => p.id)).toEqual(['p1', 'p2']);
    expect(list[0].title).toBe('New name');
    expect(list).toHaveLength(2);
  });

  it('keeps the createdByMe flag sticky once set', () => {
    rememberPoll({ id: 'p1', title: 'Mine', createdByMe: true });
    rememberPoll({ id: 'p1', title: 'Mine' });
    expect(getMyPolls()[0].createdByMe).toBe(true);
  });

  it('caps the list at 50 entries, dropping the oldest', () => {
    for (let i = 1; i <= 55; i++) {
      rememberPoll({ id: 'p' + i, title: 'Poll ' + i });
    }
    const list = getMyPolls();
    expect(list).toHaveLength(50);
    expect(list[0].id).toBe('p55');
    expect(list.at(-1).id).toBe('p6');
  });
});

describe('forgetPoll', () => {
  it('removes only the given poll', () => {
    rememberPoll({ id: 'p1', title: 'One' });
    rememberPoll({ id: 'p2', title: 'Two' });
    forgetPoll('p1');
    expect(getMyPolls().map(p => p.id)).toEqual(['p2']);
  });

  it('is a no-op for unknown ids', () => {
    rememberPoll({ id: 'p1', title: 'One' });
    forgetPoll('nope');
    expect(getMyPolls()).toHaveLength(1);
  });
});
