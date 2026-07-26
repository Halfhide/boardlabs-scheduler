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

  if (polls.length === 0) {
    return null;
  }

  const handleRemove = (id) => {
    forgetPoll(id);
    setLocalPolls(getMyPolls());
    if (uid) forgetPollForUser(uid, id);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto mt-6">
      <h3 className="text-lg font-bold text-gray-900 mb-1">{t('yourPolls')}</h3>
      <p className="text-xs text-gray-400 mb-2">
        {uid ? t('yourPollsHintSynced') : t('yourPollsHint')}
      </p>
      <ul className="divide-y divide-gray-100">
        {polls.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <Link to={`/poll/${p.id}`} className="flex-1 min-w-0 group">
              <span className="block text-sm font-medium text-gray-900 group-hover:text-blue-700 truncate">
                {p.title}
              </span>
              <span className="block text-xs text-gray-500">
                {t('lastOpened', {
                  time: formatDistanceToNow(p.lastSeen, {
                    addSuffix: true,
                    locale: dateLocale
                  })
                })}
              </span>
            </Link>
            {p.createdByMe && (
              <span className="flex-shrink-0 text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                {t('yoursBadge')}
              </span>
            )}
            <button
              onClick={() => handleRemove(p.id)}
              aria-label={t('removeFromListAria', { title: p.title })}
              title={t('removeFromList')}
              className="flex-shrink-0 text-gray-400 hover:text-red-600 text-xl leading-none px-1"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default MyPolls;
