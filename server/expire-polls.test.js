import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ db: { collection: vi.fn(), batch: vi.fn() } }));
vi.mock('firebase-admin/app', () => ({ getApps: () => [{}], initializeApp: vi.fn(), cert: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mocks.db, FieldPath: { documentId: () => 'id' } }));
import handler from '../api/expire-polls';
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('CRON_SECRET', 'synthetic'); vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', '{}'); });
afterEach(() => vi.unstubAllEnvs());
const response = () => ({ setHeader: vi.fn(), end: vi.fn() });
it('requires cron authentication before any database access', async () => {
  const res = response(); await handler({ headers: {} }, res);
  expect(res.statusCode).toBe(401); expect(mocks.db.collection).not.toHaveBeenCalled();
});
it('expires both legacy and trusted polls while retaining future and malformed dates', async () => {
  const deleted = [];
  mocks.db.batch.mockImplementation(() => ({ delete: ref => deleted.push(ref), commit: async () => {} }));
  mocks.db.collection.mockImplementation(name => {
    const query = { orderBy: () => query, limit: () => query, get: async () => ({ size: 3, docs: [
      { id: 'old', ref: `${name}/old`, data: () => ({ dates: [{ date: '2020-01-01' }] }) },
      { id: 'future', ref: `${name}/future`, data: () => ({ dates: [{ date: '2999-01-01' }] }) },
      { id: 'broken', ref: `${name}/broken`, data: () => ({ dates: [] }) },
    ] }) }; return query;
  });
  const res = response(); await handler({ headers: { authorization: 'Bearer synthetic' } }, res);
  expect(res.statusCode).toBe(200);
  expect(deleted).toEqual(['polls/old', 'pollsV2/old']);
  expect(JSON.parse(res.end.mock.calls[0][0])).toMatchObject({ scanned: 6, deleted: 2 });
});
