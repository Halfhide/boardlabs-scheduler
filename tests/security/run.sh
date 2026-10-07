#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
export MEPPLE_EMULATORS=true
export CI=true
unset GOOGLE_APPLICATION_CREDENTIALS FIREBASE_TOKEN GOOGLE_CLOUD_PROJECT GCLOUD_PROJECT
mkdir -p tests/results
case "${1:-all}" in all|browser|remaining|release-backend|trusted-recovery-browser|trusted-auth-browser|trusted-identity-browser|trusted-device-tabs-browser|trusted-failures-browser|trusted-google-browser|trusted-ui-browser|quality-recovery-browser) ;; *) exit 2 ;; esac
if [ -n "${FIREBASE_CLI_TOOL:-}" ]; then
  exec node "$FIREBASE_CLI_TOOL" emulators:exec --only firestore,auth --project demo-meppletime-local --config firebase.test.json "node tests/security/suite.mjs ${1:-all}"
fi
exec npx --yes firebase-tools@15.29.0 emulators:exec --only firestore,auth --project demo-meppletime-local --config firebase.test.json "node tests/security/suite.mjs ${1:-all}"
