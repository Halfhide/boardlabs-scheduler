import { createServer } from 'node:http';
import { trustedHandler } from '../../server/handler.mjs';
createServer((req, res) => trustedHandler(req, res, req.url.split('/').at(-1))).listen(15175, '127.0.0.1');
