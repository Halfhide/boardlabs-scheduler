// Loads every Vercel function the way the production runtime does.
// Vercel's module loader cannot require() ES modules, even on Node
// versions that can, so a dependency doing that crashes every request
// with FUNCTION_INVOCATION_FAILED (12 Oct 2026: jwks-rsa -> jose 6).
// Run with --no-experimental-require-module (see `npm run check:functions`).
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const dir = new URL('../api/', import.meta.url);
let failed = false;
for (const file of readdirSync(dir).filter(name => name.endsWith('.js') && !name.endsWith('.test.js'))) {
  try {
    await import(pathToFileURL(new URL(file, dir).pathname).href);
    console.log(`ok   api/${file}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL api/${file}: ${error.code || ''} ${error.message.split('\n')[0]}`);
  }
}
if (failed) process.exit(1);
