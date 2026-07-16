import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { getMyPolls, forgetPoll } from '../../utils/myPolls';
import { useTranslation } from '../../i18n/useTranslation';

function MyPolls() {
  const { t, dateLocale } = useTranslation();
  const [polls, setPolls] = useState(() => getMyPolls());

  if (polls.length === 0) {
    return null;
  }

  const handleRemove = (id) => {
    forgetPoll(id);
    setPolls(getMyPolls());
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto mt-6">
      <h3 className="text-lg font-bold text-gray-900 mb-1">{t('yourPolls')}</h3>
      <p className="text-xs text-gray-400 mb-2">
        {t('yourPollsHint')}
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
