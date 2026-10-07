import { trustedMode } from '../utils/trustedClient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithCredential,
  signInAnonymously,
  linkWithPopup,
  EmailAuthProvider,
  updateCurrentUser,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { auth, pendingAuth, recoveryAuth, db, apiHeaders } from '../firebase';
import { collection, query, where, getDocsFromServer } from 'firebase/firestore';
import { AuthContext } from './context';

// Email awaiting a magic-link round trip (same key Firebase docs use)
const EMAIL_FOR_SIGN_IN_KEY = 'emailForSignIn';

function readStoredEmail() {
  try {
    return window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY) || '';
  } catch {
    return '';
  }
}

function storeEmail(email) {
  try {
    window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email);
  } catch {
    // Cross-device flow covers the no-storage case: the user is
    // asked to confirm the email when the link is opened.
  }
}

function clearStoredEmail() {
  try {
    window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
  } catch {
    // ignore
  }
}

// Remove Firebase's oobCode etc. so reloads do not retry a spent link
function stripLinkParams() {
  try {
    window.history.replaceState(null, '', window.location.pathname);
  } catch {
    // ignore
  }
}

const TRANSFER_KEY = 'meppletime-pending-transfer';
function readTransfer() {
  const raw = localStorage.getItem(TRANSFER_KEY);
  return raw ? JSON.parse(raw) : null;
}
async function restoreTransferMarker() {
  const existing = readTransfer();
  const source = auth.currentUser;
  if (existing || !trustedMode || !source?.isAnonymous) return existing;
  const response = await fetch('/api/trusted-status', {
    method: 'POST', headers: await apiHeaders(source),
    body: '{}',
  });
  if (!response.ok) throw new Error('Could not check pending move');
  const { migration } = await response.json();
  if (auth.currentUser?.uid !== source.uid) throw new Error('Identity changed');
  // Never replace progress another tab saved while the status request ran.
  const current = readTransfer();
  if (current) return current;
  if (migration) {
    if (migration.sourceUid !== source.uid || !migration.targetUid || migration.version !== 2) throw new Error('Invalid migration status');
    localStorage.setItem(TRANSFER_KEY, JSON.stringify(migration));
  }
  return migration;
}
function guardSignIn() {
  if (readTransfer()) throw new Error('Finish the pending poll move first');
}
let guestPromise;
async function ensureGuest() {
  guardSignIn();
  await auth.authStateReady();
  await restoreTransferMarker();
  guardSignIn();
  if (auth.currentUser) return auth.currentUser;
  if (!guestPromise) guestPromise = signInAnonymously(auth).then(r => r.user).finally(() => { guestPromise = null; });
  return guestPromise;
}
function recoveryError(code) { return Object.assign(new Error(code), { code }); }
function recoverySnapshot() {
  const marker = readTransfer();
  if (!trustedMode || marker?.version !== 2) throw recoveryError('recovery/unavailable');
  if (!auth.currentUser?.isAnonymous || auth.currentUser.uid !== marker.sourceUid) {
    throw recoveryError('recovery/source');
  }
  return { sourceUid: marker.sourceUid, targetUid: marker.targetUid };
}
let recoveryInFlight = false;
async function recoverDestination(signIn) {
  if (recoveryInFlight) throw recoveryError('recovery/busy');
  recoveryInFlight = true;
  try {
    await Promise.all([auth.authStateReady(), pendingAuth.authStateReady()]);
    const before = recoverySnapshot();
    const pendingUid = pendingAuth.currentUser?.uid;
    const { user: candidate } = await signIn();
    const after = recoverySnapshot();
    if (before.sourceUid !== after.sourceUid || before.targetUid !== after.targetUid
      || pendingAuth.currentUser?.uid !== pendingUid) throw recoveryError('recovery/changed');
    if (candidate.isAnonymous || candidate.uid !== before.targetUid) throw recoveryError('recovery/wrong-account');
    // The candidate is authenticated, but only the original destination may
    // replace the pending session. Never replace the primary guest here.
    await updateCurrentUser(pendingAuth, candidate);
  } finally {
    try { await signOut(recoveryAuth); } finally { recoveryInFlight = false; }
  }
}
async function acceptCredential(credential) {
  await auth.authStateReady();
  await restoreTransferMarker();
  if (trustedMode && readTransfer()) {
    return recoverDestination(() => signInWithCredential(recoveryAuth, credential));
  }
  guardSignIn();
  await auth.authStateReady();
  await restoreTransferMarker();
  guardSignIn();
  // Email links are single-use. Verify once in a separate persistent session,
  // then transfer ownership after consent. A failed link attempt can consume
  // the code, so do not use link-then-sign-in as an email fallback.
  return signInWithCredential(auth.currentUser?.isAnonymous ? pendingAuth : auth, credential);
}

function AuthProvider({ children }) {
  // Firebase can mutate the same User object when linking a guest account.
  // A fresh wrapper makes that transition observable to React.
  const [identityState, setIdentityState] = useState({ user: null });
  const identity = identityState.user;
  const user = identity && !identity.isAnonymous ? identity : null;
  const [pendingUser, setPendingUser] = useState(null);
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferError, setTransferError] = useState(false);
  const [transferStarted, setTransferStarted] = useState(() => {
    try { return !!readTransfer(); } catch { return true; }
  });
  const [transferDetails, setTransferDetails] = useState(() => {
    try { return readTransfer(); } catch { return null; }
  });
  useEffect(() => {
    const syncTransfer = (event) => {
      if (event.key !== TRANSFER_KEY && event.key !== null) return;
      try { const marker = readTransfer(); setTransferStarted(!!marker); setTransferDetails(marker); }
      catch { setTransferStarted(true); }
    };
    window.addEventListener('storage', syncTransfer);
    return () => window.removeEventListener('storage', syncTransfer);
  }, []);
  useEffect(() => onAuthStateChanged(pendingAuth, setPendingUser), []);
  const cancelTransfer = useCallback(async () => {
    try {
      // Recheck shared state even if this tab has not rendered a storage event.
      await restoreTransferMarker();
      guardSignIn();
      await signOut(pendingAuth);
    } catch {
      setTransferStarted(true);
      setTransferError(true);
    }
  }, []);
  const finishTransfer = useCallback(async () => {
    if (recoveryInFlight) return;
    setTransferBusy(true);
    setTransferError(false);
    try {
      await Promise.all([auth.authStateReady(), pendingAuth.authStateReady()]);
      await restoreTransferMarker();
      const source = auth.currentUser;
      const target = pendingAuth.currentUser;
      const previous = readTransfer();
      // A reload can happen after the primary session switched, but before
      // secondary-session cleanup. Keep the recovery panel available then.
      if (previous?.phase === 'ready' && source?.uid === previous.targetUid) {
        if (target && target.uid !== previous.targetUid) throw new Error('Identity changed');
        await signOut(pendingAuth);
        localStorage.removeItem(TRANSFER_KEY);
        setTransferStarted(false); setTransferDetails(null);
        return;
      }
      if (!source?.isAnonymous || !target || target.isAnonymous) throw new Error('Missing identities');
      if (previous && (previous.sourceUid !== source.uid || previous.targetUid !== target.uid)) throw new Error('Identity changed');
      const marker = { sourceUid: source.uid, targetUid: target.uid, version: trustedMode ? 2 : 1, targetEmail: previous?.targetEmail || target.email || '' };
      if (previous?.version && previous.version !== marker.version) throw new Error('Transfer mode changed');
      localStorage.setItem(TRANSFER_KEY, JSON.stringify(marker));
      setTransferStarted(true);
      setTransferDetails(marker);
      const guestToken = await source.getIdToken(true);
      const accountToken = await target.getIdToken(true);
      const assertCurrentPair = () => {
        const current = readTransfer();
        // Another tab may already have completed this exact move. A different
        // account must never be overwritten or signed out by this old request.
        if (auth.currentUser?.uid === target.uid && !pendingAuth.currentUser && !current) return false;
        if (![source.uid, target.uid].includes(auth.currentUser?.uid)
          || pendingAuth.currentUser?.uid !== target.uid
          || current?.sourceUid !== source.uid || current?.targetUid !== target.uid) {
          throw new Error('Identity changed during transfer');
        }
        return true;
      };
      if (!assertCurrentPair()) { setTransferStarted(false); setTransferDetails(null); return; }
      if (trustedMode) {
        let complete = false;
        for (let batch = 0; batch < 251; batch++) {
          if (!assertCurrentPair()) { setTransferStarted(false); setTransferDetails(null); return; }
          const response = await fetch('/api/trusted-migrate', {
            method: 'POST',
            headers: await apiHeaders(source),
            body: JSON.stringify({ accountToken: await target.getIdToken() }),
          });
          if (!response.ok) throw new Error('Transfer failed');
          const progress = await response.json();
          if (!assertCurrentPair()) { setTransferStarted(false); setTransferDetails(null); return; }
          if (!['running', 'complete'].includes(progress.state)
            || !Number.isInteger(progress.remaining) || progress.remaining < 0) throw new Error('Invalid progress');
          if (progress.state === 'complete' && progress.remaining === 0) { complete = true; break; }
          if (progress.retryAfterMs) await new Promise(resolve => setTimeout(resolve, Math.min(2000, Math.max(250, progress.retryAfterMs))));
        }
        if (!complete) throw new Error('Transfer incomplete');
      } else {
        // An empty offline cache is not proof that the guest owns no polls.
        // Keep both sessions if the server cannot confirm the remaining work.
        const polls = await getDocsFromServer(query(collection(db, 'polls'), where('ownerUid', '==', source.uid)));
        for (const poll of polls.docs) {
          if (!assertCurrentPair()) { setTransferStarted(false); setTransferDetails(null); return; }
          const response = await fetch('/api/transfer-poll', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pollId: poll.id, guestToken, accountToken }),
          });
          if (!response.ok) throw new Error('Transfer failed');
        }
      }
      // Durable completion precedes any session switch, so retry can recover
      // even if switching succeeds but clearing the secondary session fails.
      if (!assertCurrentPair()) { setTransferStarted(false); setTransferDetails(null); return; }
      localStorage.setItem(TRANSFER_KEY, JSON.stringify({ ...marker, phase: 'ready' }));
      await updateCurrentUser(auth, target);
      if (!assertCurrentPair()) { setTransferStarted(false); setTransferDetails(null); return; }
      await signOut(pendingAuth);
      localStorage.removeItem(TRANSFER_KEY);
      setTransferStarted(false); setTransferDetails(null);
    } catch { setTransferError(true); }
    finally { setTransferBusy(false); }
  }, []);
  const [authLoading, setAuthLoading] = useState(true);
  // 'idle' | 'completing' (link opened, stored email known)
  // | 'needEmail' (link opened on a device without the stored email)
  const [emailLinkStatus, setEmailLinkStatus] = useState(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return 'idle';
    return readStoredEmail() ? 'completing' : 'needEmail';
  });
  // Translation key for a failed automatic link completion
  const [emailLinkError, setEmailLinkError] = useState(null);
  const completingRef = useRef(false);

  useEffect(() => {
    let revision = 0;
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      const currentRevision = ++revision;
      setIdentityState({ user: nextUser });
      // Migration changes ownership on the server; wake background tabs immediately.
      window.dispatchEvent(new Event('trusted-change'));
      setAuthLoading(true);
      try {
        await restoreTransferMarker();
        if (currentRevision === revision) {
          const marker = readTransfer();
          setTransferStarted(!!marker);
          setTransferDetails(marker);
        }
      } catch {
        if (currentRevision === revision) {
          setTransferStarted(true);
          setTransferError(true);
        }
      } finally {
        if (currentRevision === revision) setAuthLoading(false);
      }
    });
    return () => { revision++; unsubscribe(); };
  }, []);

  // Finish the magic link automatically when we know the email
  useEffect(() => {
    if (emailLinkStatus !== 'completing' || completingRef.current) return;
    completingRef.current = true;
    acceptCredential(EmailAuthProvider.credentialWithLink(readStoredEmail(), window.location.href))
      .then(() => {
        clearStoredEmail();
        stripLinkParams();
        setEmailLinkStatus('idle');
        setTransferError(false);
        setEmailLinkError(null);
      })
      .catch((error) => {
        completingRef.current = false;
        clearStoredEmail();
        if (
          error?.code === 'auth/invalid-email' ||
          error?.code === 'auth/email-mismatch'
        ) {
          // Stored email does not match the link: ask for it
          setEmailLinkStatus('needEmail');
          setEmailLinkError('errAuthEmailMismatch');
        } else {
          stripLinkParams();
          setEmailLinkStatus('idle');
          setEmailLinkError(error?.code?.startsWith('recovery/') ? 'transferRecoveryWrong' : 'errAuthLinkInvalid');
        }
      });
  }, [emailLinkStatus]);

  const signInWithGoogle = useCallback(async () => {
    guardSignIn();
    await auth.authStateReady();
    await restoreTransferMarker();
    guardSignIn();
    if (!auth.currentUser?.isAnonymous) return signInWithPopup(auth, new GoogleAuthProvider());
    if (trustedMode) return signInWithPopup(pendingAuth, new GoogleAuthProvider());
    try {
      const result = await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
      setIdentityState({ user: result.user });
    }
    catch (error) {
      console.warn('Local Google sign-in error:', error.code, error.message);
      if (!['auth/credential-already-in-use', 'auth/email-already-in-use'].includes(error.code)) throw error;
      const credential = GoogleAuthProvider.credentialFromError(error);
      if (!credential) throw error;
      await signInWithCredential(pendingAuth, credential);
    }
  }, []);

  const sendMagicLink = useCallback(async (email) => {
    guardSignIn();
    await restoreTransferMarker();
    guardSignIn();
    const trimmed = email.trim();
    auth.languageCode = document.documentElement.lang;
    await sendSignInLinkToEmail(auth, trimmed, {
      url: window.location.href,
      handleCodeInApp: true
    });
    storeEmail(trimmed);
  }, []);

  // Cross-device completion: the user typed the email by hand
  const completeMagicLink = useCallback(async (email) => {
    await acceptCredential(EmailAuthProvider.credentialWithLink(email.trim(), window.location.href));
    clearStoredEmail();
    stripLinkParams();
    setEmailLinkStatus('idle');
    setEmailLinkError(null);
  }, []);

  const cancelEmailLink = useCallback(() => {
    stripLinkParams();
    setEmailLinkStatus('idle');
    setEmailLinkError(null);
  }, []);

  const recoverWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    // Pass the popup resolver explicitly because recoveryAuth uses initializeAuth.
    await recoverDestination(() => signInWithPopup(recoveryAuth, provider, browserPopupRedirectResolver));
    setTransferError(false);
    setEmailLinkError(null);
  }, []);

  const sendRecoveryLink = useCallback(async (email) => {
    await auth.authStateReady();
    await restoreTransferMarker();
    recoverySnapshot();
    const trimmed = email.trim();
    recoveryAuth.languageCode = document.documentElement.lang;
    await sendSignInLinkToEmail(recoveryAuth, trimmed, {
      url: window.location.origin + window.location.pathname,
      handleCodeInApp: true,
    });
    storeEmail(trimmed);
    setEmailLinkError(null);
  }, []);

  const signOutUser = useCallback(async () => {
    guardSignIn();
    await signOut(auth);
  }, []);

  const transferTargetEmail = transferDetails?.targetEmail
    || (pendingUser?.uid === transferDetails?.targetUid ? pendingUser?.email : '') || '';
  const canRecoverTransfer = trustedMode && transferDetails?.version === 2
    && identity?.isAnonymous && transferDetails.sourceUid === identity.uid;

  const value = useMemo(
    () => ({
      user,
      identity,
      ensureGuest,
      transferStarted,
      pendingUser,
      transferBusy,
      transferError,
      finishTransfer,
      cancelTransfer,
      recoverWithGoogle,
      sendRecoveryLink,
      transferTargetEmail,
      canRecoverTransfer,
      authLoading,
      emailLinkStatus,
      emailLinkError,
      signInWithGoogle,
      sendMagicLink,
      completeMagicLink,
      cancelEmailLink,
      signOutUser
    }),
    [
      user,
      identity,
      transferStarted,
      pendingUser,
      transferBusy,
      transferError,
      finishTransfer,
      cancelTransfer,
      recoverWithGoogle,
      sendRecoveryLink,
      transferTargetEmail,
      canRecoverTransfer,
      authLoading,
      emailLinkStatus,
      emailLinkError,
      signInWithGoogle,
      sendMagicLink,
      completeMagicLink,
      cancelEmailLink,
      signOutUser
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
