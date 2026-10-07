import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { useTranslation } from '../i18n/useTranslation';
import { trustedMode } from '../utils/trustedClient';

export default function TransferPanel() {
  const { t } = useTranslation();
  const { identity, pendingUser, transferStarted, transferBusy, transferError,
    authLoading, finishTransfer, cancelTransfer, recoverWithGoogle, sendRecoveryLink,
    transferTargetEmail, canRecoverTransfer, emailLinkError } = useAuth();
  const recoveryPanel = useRef(null);
  useEffect(() => {
    if (emailLinkError && recoveryPanel.current) recoveryPanel.current.open = true;
  }, [emailLinkError, canRecoverTransfer]);
  const [email, setEmail] = useState('');
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState(null);
  const [recoveryError, setRecoveryError] = useState(null);
  const recover = async (action, success) => {
    if (recoveryBusy) return;
    setRecoveryBusy(true); setRecoveryError(null); setRecoveryMessage(null);
    try { await action(); setRecoveryMessage(success); }
    catch (error) {
      if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error.code)) {
        setRecoveryError(error.code === 'recovery/wrong-account' ? 'transferRecoveryWrong'
          : error.code === 'recovery/source' ? 'transferRecoverySource'
          : error.code === 'auth/popup-blocked' ? 'errAuthPopupBlocked'
          : 'transferRecoveryFailed');
      }
    } finally { setRecoveryBusy(false); }
  };
  if (!((identity?.isAnonymous && pendingUser) || transferStarted)) return null;
  return <section aria-labelledby="transfer-title" className="bg-surface rounded-lg shadow-md p-6 mb-6 space-y-3" data-testid="transfer-panel">
    <h2 id="transfer-title" className="text-xl font-bold text-ink">{t('transferTitle')}</h2>
    <p className="text-sm text-neutral-700 [overflow-wrap:anywhere]">{t(trustedMode ? 'transferHelpV2' : 'transferHelp', { email: transferStarted ? (transferTargetEmail || t('transferOriginalAccount')) : (pendingUser?.email || pendingUser?.displayName || t('transferOriginalAccount')) })}</p>
    {transferStarted && <p className="text-sm text-neutral-700">{t('transferResumeHelp')}</p>}
    {transferError && <p role="alert" className="text-sm text-danger-700 bg-danger-100 border border-danger-200 rounded-md p-3">{t('transferError')}</p>}
    <div className="flex flex-col sm:flex-row gap-3 pt-1">
      <button className="min-h-11 bg-terra-700 hover:bg-terra-800 text-ground rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed" onClick={finishTransfer} disabled={authLoading || transferBusy || recoveryBusy} data-testid="transfer-confirm">{t(transferBusy ? 'transferBusy' : 'transferGo')}</button>
      <button className="min-h-11 border border-neutral-400 text-neutral-800 hover:bg-ground rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed" onClick={cancelTransfer} data-testid="transfer-cancel" disabled={authLoading || transferBusy || transferStarted}>{t('transferCancel')}</button>
    </div>
    {trustedMode && transferStarted && (canRecoverTransfer ?
      <details ref={recoveryPanel} className="border-t border-neutral-300 pt-3" data-testid="transfer-recovery">
        <summary className="cursor-pointer min-h-11 py-3 font-semibold text-neutral-800">{t('transferRecoveryTitle')}</summary>
        <p className="text-sm text-neutral-700 mb-3">{t('transferRecoveryHelp')}</p>
        {(recoveryError || emailLinkError) && <p role="alert" className="p-3 mb-3 rounded-md bg-danger-100 text-danger-700">{t(recoveryError || emailLinkError)}</p>}
        {recoveryMessage && <p role="status" className="p-3 mb-3 rounded-md bg-sage-100 text-sage-800">{t(recoveryMessage)}</p>}
        <button type="button" data-testid="recovery-google" disabled={authLoading || transferBusy || recoveryBusy}
          onClick={() => recover(recoverWithGoogle, 'transferRecoverySuccess')}
          className="min-h-11 px-5 py-3 border border-neutral-400 rounded-full text-sm font-semibold disabled:opacity-50">{t('continueWithGoogle')}</button>
        <form className="mt-4 space-y-2" onSubmit={e => { e.preventDefault(); recover(() => sendRecoveryLink(email), 'transferRecoverySent'); }}>
          <label htmlFor="recovery-email" className="block text-sm font-semibold">{t('emailLabel')}</label>
          <input id="recovery-email" type="email" autoComplete="email" required value={email}
            disabled={authLoading || transferBusy || recoveryBusy} onChange={e => setEmail(e.target.value)}
            className="w-full min-h-11 border border-neutral-400 rounded-full px-4 py-3 focus:ring-2 focus:ring-terra" />
          <button type="submit" disabled={authLoading || transferBusy || recoveryBusy || !email.trim()}
            className="min-h-11 px-5 py-3 border border-neutral-400 rounded-full text-sm font-semibold disabled:opacity-50">{t(recoveryBusy ? 'signingIn' : 'sendMagicLink')}</button>
        </form>
      </details>
      : identity?.isAnonymous ? null : <p role="status" className="text-sm text-neutral-700">{t('transferRecoverySource')}</p>)}
  </section>;
}
