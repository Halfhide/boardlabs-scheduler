import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useTranslation } from '../../i18n/useTranslation';

// Map Firebase Auth error codes to translation keys; null = ignore
function errorKey(error) {
  const code = error?.code || '';
  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  ) {
    return null;
  }
  if (
    code === 'auth/invalid-email' ||
    code === 'auth/missing-email' ||
    code === 'auth/email-mismatch'
  ) {
    return 'errAuthInvalidEmail';
  }
  if (
    code === 'auth/invalid-action-code' ||
    code === 'auth/expired-action-code'
  ) {
    return 'errAuthLinkInvalid';
  }
  if (code === 'auth/popup-blocked') return 'errAuthPopupBlocked';
  if (code === 'auth/network-request-failed') return 'errAuthNetwork';
  if (code === 'auth/too-many-requests') return 'errAuthTooMany';
  return 'errAuthGeneric';
}

function GoogleLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function SignInModal({ onClose }) {
  const { t } = useTranslation();
  const {
    emailLinkStatus,
    emailLinkError,
    signInWithGoogle,
    sendMagicLink,
    completeMagicLink,
    cancelEmailLink
  } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState(null);
  const [error, setError] = useState(null);

  const needEmail = emailLinkStatus === 'needEmail';
  const completing = emailLinkStatus === 'completing';
  const shownError = error || (needEmail ? emailLinkError : null);

  const close = () => {
    if (emailLinkStatus !== 'idle') cancelEmailLink();
    onClose();
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err) {
      const key = errorKey(err);
      if (key) setError(key);
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setError(null);
    setBusy(true);
    try {
      if (needEmail) {
        await completeMagicLink(email);
        onClose();
      } else {
        await sendMagicLink(email);
        setSentTo(email.trim());
      }
    } catch (err) {
      setError(errorKey(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={close}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-xl font-bold text-gray-900">
            {needEmail ? t('confirmEmailTitle') : t('signInTitle')}
          </h2>
          <button
            onClick={close}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label={t('closeButton')}
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          {needEmail ? t('confirmEmailHelp') : t('signInOptionalHint')}
        </p>

        {shownError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {t(shownError)}
          </div>
        )}

        {completing ? (
          <p className="text-sm text-gray-600 py-2">{t('signingIn')}</p>
        ) : sentTo ? (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
            {t('linkSent', { email: sentTo })}
            <p className="mt-2 font-bold">⚠️ {t('linkSentSpamHint')}</p>
          </div>
        ) : (
          <>
            {!needEmail && (
              <>
                <button
                  onClick={handleGoogle}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 font-medium text-gray-700 disabled:opacity-50 transition-colors"
                >
                  <GoogleLogo />
                  {t('continueWithGoogle')}
                </button>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 border-t border-gray-200" />
                  <span className="text-xs text-gray-400 uppercase">
                    {t('orDivider')}
                  </span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>
              </>
            )}
            <form onSubmit={handleEmailSubmit}>
              <label
                htmlFor="signin-email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t('emailLabel')}
              </label>
              <input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                autoComplete="email"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              />
              <button
                type="submit"
                disabled={busy || !email.trim()}
                className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 transition-colors"
              >
                {busy
                  ? needEmail
                    ? t('signingIn')
                    : t('sendingLink')
                  : needEmail
                    ? t('completeSignIn')
                    : t('sendMagicLink')}
              </button>
              {!needEmail && (
                <p className="mt-2 text-xs text-gray-500">
                  {t('magicLinkHelp')}
                </p>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function AccountMenu() {
  const { t } = useTranslation();
  const { user, authLoading, emailLinkStatus, emailLinkError, signOutUser } =
    useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Track a dismissed link error so the modal does not force itself open
  const [dismissedError, setDismissedError] = useState(null);

  // A pending magic link (or its failure) opens the modal by itself
  const linkNeedsAttention =
    emailLinkStatus !== 'idle' ||
    (!!emailLinkError && emailLinkError !== dismissedError && !user);
  const showModal = modalOpen || linkNeedsAttention;

  const closeModal = () => {
    setModalOpen(false);
    if (emailLinkError) setDismissedError(emailLinkError);
  };

  if (authLoading) {
    return <div className="w-20" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="px-3 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          {t('signIn')}
        </button>
        {showModal && <SignInModal onClose={closeModal} />}
      </>
    );
  }

  const displayName = user.displayName || user.email || '';
  const initial = (displayName[0] || '?').toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((open) => !open)}
        aria-label={t('accountMenuAria')}
        aria-expanded={menuOpen}
        className="flex items-center gap-2 rounded-full hover:opacity-80 transition-opacity"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-full border border-gray-200"
          />
        ) : (
          <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
            {initial}
          </span>
        )}
      </button>
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1">
            <div className="px-4 py-2 border-b border-gray-100">
              {user.displayName && (
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {user.displayName}
                </p>
              )}
              {user.email && (
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              )}
            </div>
            <button
              onClick={() => {
                setMenuOpen(false);
                signOutUser();
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {t('signOut')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default AccountMenu;
