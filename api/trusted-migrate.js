import { trustedHandler } from '../server/handler.mjs';
export default (req, res) => trustedHandler(req, res, 'trusted-migrate');
