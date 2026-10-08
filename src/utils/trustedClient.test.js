import { describe, expect, it, vi } from 'vitest';
vi.mock('../firebase', () => ({ auth: {}, apiHeaders: vi.fn() }));
import { isTrustedPoll } from './trustedClient';
describe('poll namespace routing', () => {
  it('recognizes only the generated v2 namespace', () => {
    expect(isTrustedPoll('v2_abcdefghijklmnop')).toBe(true);
    expect(isTrustedPoll('v2_legacy1')).toBe(false);
    expect(isTrustedPoll('oldpoll123')).toBe(false);
    expect(isTrustedPoll(undefined)).toBe(false);
    expect(isTrustedPoll(123)).toBe(false);
  });
});
