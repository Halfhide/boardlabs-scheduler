import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { getMyPolls, forgetPoll } from '../../utils/myPolls';
import {
  watchUserPolls,
  syncLocalPollsUp,
  forgetPollForUser
} from '../../utils/userPolls';
import { useAuth } from '../../auth/useAuth';
import { useTranslation } from '../../i18n/useTranslation';

function MyPolls() {
  const { t, dateLocale } = useTranslation();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [localPolls, setLocalPolls] = useState(() => getMyPolls());
  // Cloud list keyed by the uid it belongs to, so a sign-out or
  // account switch never shows another account's list (derived
  // below instead of reset in an effect)
  const [cloud, setCloud] = useState({ uid: null, byId: null });
  const cloudById = uid && cloud.uid === uid ? cloud.byId : null;

  useEffect(() => {
    if (!uid) return;
    return watchUserPolls(uid, (byId) => setCloud({ uid, byId }));
  }, [uid]);

  // Once per account per mount: push local-only entries up so the
  // account list absorbs this browser's history
  const syncedForRef = useRef(null);
  useEffect(() => {
    if (!uid || !cloudById || syncedForRef.current === uid) return;
    syncedForRef.current = uid;
    syncLocalPollsUp(uid, getMyPolls(), cloudById);
  }, [uid, cloudById]);

  // The list shown is the union: newest lastSeen wins the title,
  // the created-by-me badge is sticky across both sources
  const polls = useMemo(() => {
    const byId = new Map();
    localPolls.forEach((p) => byId.set(p.id, { ...p }));
    if (cloudById) {
      Object.values(cloudById).forEach((c) => {
        const local = byId.get(c.id);
        byId.set(c.id, {
          id: c.id,
          title: c.lastSeen >= (local?.lastSeen ?? 0) ? c.title : local.title,
          createdByMe: !!(local?.createdByMe || c.createdByMe),
          lastSeen: Math.max(local?.lastSeen ?? 0, c.lastSeen)
        });
      });
    }
    return [...byId.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  }, [localPolls, cloudById]);

  // Removal is two-step so a stray click cannot silently lose the
  // only pointer to a poll; the armed state disarms itself
  const [confirmingId, setConfirmingId] = useState(null);
  useEffect(() => {
    if (!confirmingId) return;
    const timer = setTimeout(() => setConfirmingId(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmingId]);

  if (polls.length === 0) {
    return null;
  }

  const handleRemove = (id) => {
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    setConfirmingId(null);
    forgetPoll(id);
    setLocalPolls(getMyPolls());
    if (uid) forgetPollForUser(uid, id);
  };

  return (
    <div className="bg-surface rounded-lg shadow-md p-6 max-w-2xl mx-auto mt-6">
      <h3 className="text-lg font-bold text-ink mb-1">{t('yourPolls')}</h3>
      <p className="text-xs text-neutral-500 mb-2">
        {uid ? t('yourPollsHintSynced') : t('yourPollsHint')}
      </p>
      <ul className="divide-y divide-neutral-200">
        {polls.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <Link to={`/poll/${p.id}`} className="flex-1 min-w-0 group">
              <span className="block text-sm font-medium text-ink group-hover:text-terra-700 truncate">
                {p.title}
              </span>
              <span className="block text-xs text-neutral-600">
                {t('lastOpened', {
                  time: formatDistanceToNow(p.lastSeen, {
                    addSuffix: true,
                    locale: dateLocale
                  })
                })}
              </span>
            </Link>
            {p.createdByMe && (
              <span className="flex-shrink-0 text-[10px] font-bold uppercase bg-sage-200 text-sage-800 px-2 py-0.5 rounded-full">
                {t('yoursBadge')}
              </span>
            )}
            {confirmingId === p.id ? (
              <button
                onClick={() => handleRemove(p.id)}
                aria-label={t('removeFromListAria', { title: p.title })}
                className="flex-shrink-0 text-xs font-semibold bg-danger-600 text-ground px-2.5 py-1 rounded-full hover:bg-danger-700 transition-colors whitespace-nowrap"
              >
                {t('confirmRemove')}
              </button>
            ) : (
              <button
                onClick={() => handleRemove(p.id)}
                aria-label={t('removeFromListAria', { title: p.title })}
                title={t('removeFromList')}
                className="flex-shrink-0 text-neutral-500 hover:text-danger-600 text-xl leading-none px-1"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default MyPolls;
