import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';

// Shown while the browser reports no network. Poll data is live from
// Firestore, so offline mode is read-only by design (roadmap: the
// shell plus a clear notice, no offline voting).
function OfflineBanner() {
  const { t } = useTranslation();
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="bg-gold-500 text-ink text-sm font-medium text-center px-4 py-2">
      📡 {t('offlineNotice')}
    </div>
  );
}

export default OfflineBanner;
