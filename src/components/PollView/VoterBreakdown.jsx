import { groupVotesByResponse, isVoteByVoter, voteWeight } from '../../utils/pollHelpers';
import { useTranslation } from '../../i18n/useTranslation';

const RESPONSE_META = [
  { key: 'yes', labelKey: 'voteYes', badge: 'bg-sage-200 text-sage-800' },
  { key: 'maybe', labelKey: 'voteMaybe', badge: 'bg-gold-100 text-gold-900' },
  { key: 'no', labelKey: 'voteNo', badge: 'bg-danger-100 text-danger-800' }
];

function VoterBreakdown({ votes, voterId, voterName, voterUid }) {
  const { t } = useTranslation();
  if (votes.length === 0) {
    return (
      <p className="text-sm text-neutral-600 italic">
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
              {t(labelKey)} ({groupVotes.reduce((n, v) => n + voteWeight(v), 0)})
            </span>
            <div className="flex flex-wrap gap-1 pt-0.5">
              {groupVotes.map((vote) => {
                const isYou = isVoteByVoter(vote, voterId, voterName, voterUid);
                return (
                  <span
                    key={vote.id}
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      isYou
                        ? 'bg-terra-100 text-terra-900 font-semibold ring-1 ring-terra-300'
                        : 'bg-neutral-200 text-neutral-800'
                    }`}
                  >
                    {vote.voterName}
                    {vote.guests > 0 && ` +${vote.guests}`}
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
