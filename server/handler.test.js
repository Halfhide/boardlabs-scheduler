import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ check: vi.fn(), activity: vi.fn(), read: vi.fn(), migrate: vi.fn(), status: vi.fn() }));
vi.mock('./admin.mjs', () => ({ emulatorMode: false, adminCheck: { verifyToken: mocks.check } }));
vi.mock('./trusted-activity.mjs', () => ({ trustedActivity: mocks.activity }));
vi.mock('./trusted-read.mjs', () => ({ trustedRead: mocks.read }));
vi.mock('./trusted-migration.mjs', () => ({ migrateTrustedIdentity: mocks.migrate, trustedMigrationStatus: mocks.status }));
import { trustedHandler } from './handler.mjs';

async function call({ route = 'trusted-activity', headers = {}, body = {}, method = 'POST' } = {}) {
  const res = { setHeader: vi.fn(), end: vi.fn() };
  await trustedHandler({ method, headers: { origin: 'https://app.meppletime.today', 'content-type': 'application/json',
    authorization: 'Bearer identity', 'x-firebase-appcheck': 'attestation', ...headers }, body }, res, route);
  return res;
}
beforeEach(() => { vi.resetAllMocks(); mocks.check.mockResolvedValue({ appId: 'test' }); mocks.activity.mockResolvedValue({ pollId: 'v2_poll' }); });
describe('production API boundary', () => {
  it('verifies attestation before reaching any data service', async () => {
    const res = await call({ body: { action: 'visit' } });
    expect(res.statusCode).toBe(200);
    expect(mocks.check).toHaveBeenCalledWith('attestation');
    expect(mocks.activity).toHaveBeenCalledWith('identity', { action: 'visit' });
  });
  it('refuses missing and invalid App Check tokens without data access', async () => {
    expect((await call({ headers: { 'x-firebase-appcheck': undefined } })).statusCode).toBe(401);
    mocks.check.mockRejectedValue(new Error('Private provider details'));
    const res = await call();
    expect(res.statusCode).toBe(400);
    expect(res.end).toHaveBeenCalledWith('{"error":"Request refused"}');
    expect(mocks.activity).not.toHaveBeenCalled();
  });
  it('rejects alternate origins, methods, routes and media types', async () => {
    expect((await call({ headers: { origin: 'https://preview.vercel.app' } })).statusCode).toBe(403);
    expect((await call({ headers: { origin: undefined } })).statusCode).toBe(403);
    expect((await call({ method: 'GET' })).statusCode).toBe(405);
    expect((await call({ route: 'unknown' })).statusCode).toBe(405);
    expect((await call({ headers: { 'content-type': 'text/plain' } })).statusCode).toBe(403);
    expect(mocks.activity).not.toHaveBeenCalled();
  });
  it('bounds parsed and streamed input before invoking commands', async () => {
    expect((await call({ body: { padding: 'x'.repeat(20000) } })).statusCode).toBe(400);
    expect((await call({ headers: { 'content-length': '20001' } })).statusCode).toBe(413);
    expect((await call({ body: [] })).statusCode).toBe(400);
    expect((await call({ body: '{' })).statusCode).toBe(400);
    expect(mocks.activity).not.toHaveBeenCalled();
  });
  it('requires identity for history but allows an attested public poll read', async () => {
    expect((await call({ route: 'trusted-read', body: { action: 'history' }, headers: { authorization: undefined } })).statusCode).toBe(401);
    mocks.read.mockResolvedValue({ poll: null });
    expect((await call({ route: 'trusted-read', body: { action: 'poll', pollId: 'v2_poll' }, headers: { authorization: undefined } })).statusCode).toBe(200);
  });
  it('never accepts caller-selected source identity for migration status', async () => {
    expect((await call({ route: 'trusted-status', body: { sourceUid: 'other' } })).statusCode).toBe(400);
    expect(mocks.status).not.toHaveBeenCalled();
    expect((await call({ route: 'trusted-migrate', body: { accountToken: 'target', sourceUid: 'other' } })).statusCode).toBe(400);
    expect(mocks.migrate).not.toHaveBeenCalled();
  });
});
