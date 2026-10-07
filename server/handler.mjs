import { adminCheck, emulatorMode } from './admin.mjs';
import { trustedActivity } from './trusted-activity.mjs';
import { migrateTrustedIdentity, trustedMigrationStatus } from './trusted-migration.mjs';
import { trustedRead } from './trusted-read.mjs';

const routes = ['trusted-activity', 'trusted-migrate', 'trusted-status', 'trusted-read'];
export async function trustedHandler(req, res, route) {
  const send = (status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'POST' || !routes.includes(route)) return send(405, { error: 'Request refused' });
  const origin = req.headers.origin;
  const allowed = emulatorMode ? ['http://127.0.0.1:15173'] : ['https://app.meppletime.today'];
  // Preview deployments share the live database: trusted APIs intentionally refuse previews.
  if (!allowed.includes(origin) || (!emulatorMode && process.env.VERCEL_ENV === 'preview')
    || req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return send(403, { error: 'Request refused' });
  if (Number(req.headers['content-length']) > 20000) return send(413, { error: 'Request too large' });
  try {
    if (!emulatorMode) {
      const proof = req.headers['x-firebase-appcheck'];
      if (typeof proof !== 'string') return send(401, { error: 'Request refused' });
      await adminCheck.verifyToken(proof);
    }
    let body = req.body;
    if (body === undefined) {
      const chunks = []; let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 20000) return send(413, { error: 'Request too large' });
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks).toString('utf8');
    }
    if (Buffer.isBuffer(body)) body = body.toString('utf8');
    if (typeof body === 'string') body = JSON.parse(body);
    if (!body || Array.isArray(body) || typeof body !== 'object' || Buffer.byteLength(JSON.stringify(body)) > 20000) return send(400, { error: 'Request refused' });
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    if (!token && !(route === 'trusted-read' && body.action === 'poll')) return send(401, { error: 'Request refused' });
    let result;
    if (route === 'trusted-status') {
      if (Object.keys(body).length) throw new Error('invalid-fields');
      result = await trustedMigrationStatus(token);
    } else if (route === 'trusted-migrate') {
      if (Object.keys(body).some(key => key !== 'accountToken')) throw new Error('invalid-fields');
      result = await migrateTrustedIdentity({ guestToken: token, accountToken: body.accountToken });
    } else if (route === 'trusted-read') result = await trustedRead(token, body);
    else result = await trustedActivity(token, body);
    return send(200, result);
  } catch {
    // Never echo tokens, credentials, internal document paths or provider errors.
    return send(400, { error: 'Request refused' });
  }
}
