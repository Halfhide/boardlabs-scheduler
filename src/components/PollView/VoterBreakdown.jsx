import { groupVotesByResponse, isVoteByVoter } from '../../utils/pollHelpers';
import { useTranslation } from '../../i18n/useTranslation';

const RESPONSE_META = [
  { key: 'yes', labelKey: 'voteYes', badge: 'bg-green-100 text-green-800' },
  { key: 'maybe', labelKey: 'voteMaybe', badge: 'bg-yellow-100 text-yellow-800' },
  { key: 'no', labelKey: 'voteNo', badge: 'bg-red-100 text-red-800' }
];

function VoterBreakdown({ votes, voterId, voterName }) {
  const { t } = useTranslation();
  if (votes.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">
        {t('noVotesBeFirst')}
      </p>
    );
  }

  const grouped = groupVotesByResponse(votes);

  return (
    <div className="space-y-2">
      {RESPONSE_META.map(({ key, labelKey, badge }) => {
        const groupVotes = grouped[key];
        if (groupVotes.length === 0) return null;

        return (
          <div key={key} className="flex items-start gap-2">
            <span className={`flex-shrink-0 text-xs font-semibold px-2 py-1 rounded ${badge}`}>
              {t(labelKey)} ({groupVotes.length})
            </span>
            <div className="flex flex-wrap gap-1 pt-0.5">
              {groupVotes.map((vote) => {
                const isYou = isVoteByVoter(vote, voterId, voterName);
                return (
                  <span
                    key={vote.id}
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      isYou
                        ? 'bg-blue-100 text-blue-900 font-semibold ring-1 ring-blue-300'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {vote.voterName}
                    {isYou && ` ${t('you')}`}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default VoterBreakdown;
