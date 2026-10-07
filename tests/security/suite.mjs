import { spawnSync } from 'node:child_process';
const suites = ['release-backend', 'trusted-recovery-browser', 'trusted-auth-browser', 'trusted-identity-browser', 'trusted-device-tabs-browser', 'trusted-failures-browser', 'trusted-google-browser', 'trusted-ui-browser'];
const selected = process.argv[2] || 'all';
if (!['all', 'browser', 'remaining'].includes(selected) && ![...suites, 'quality-recovery-browser'].includes(selected)) throw new Error('Unknown suite');
for (const suite of selected === 'all' ? suites : selected === 'browser' ? suites.filter(name => name !== 'release-backend') : selected === 'remaining' ? suites.slice(-3) : [selected]) {
  const result = spawnSync(process.execPath, [`tests/security/${suite}.mjs`], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status || 1);
}
