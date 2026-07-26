import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { auth } from '../firebase';
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

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
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

  useEffect(
    () =>
      onAuthStateChanged(auth, (nextUser) => {
        setUser(nextUser);
        setAuthLoading(false);
      }),
    []
  );

  // Finish the magic link automatically when we know the email
  useEffect(() => {
    if (emailLinkStatus !== 'completing' || completingRef.current) return;
    completingRef.current = true;
    signInWithEmailLink(auth, readStoredEmail(), window.location.href)
      .then(() => {
        clearStoredEmail();
        stripLinkParams();
        setEmailLinkStatus('idle');
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
          setEmailLinkError('errAuthLinkInvalid');
        }
      });
  }, [emailLinkStatus]);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
  }, []);

  const sendMagicLink = useCallback(async (email) => {
    const trimmed = email.trim();
    await sendSignInLinkToEmail(auth, trimmed, {
      url: window.location.href,
      handleCodeInApp: true
    });
    storeEmail(trimmed);
  }, []);

  // Cross-device completion: the user typed the email by hand
  const completeMagicLink = useCallback(async (email) => {
    await signInWithEmailLink(auth, email.trim(), window.location.href);
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

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      user,
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
