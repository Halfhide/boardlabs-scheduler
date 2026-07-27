import { useTranslation } from '../../i18n/useTranslation';

function VoteButton({ response, currentVote, onClick, loading }) {
  const { t } = useTranslation();
  const isSelected = currentVote === response;

  const baseClasses = "flex-1 py-3 px-6 rounded-full font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 text-lg";

  const variantClasses = {
    yes: isSelected
      ? "bg-sage-600 text-ground hover:bg-sage-700 focus:ring-sage-500 shadow-lg scale-105"
      : "bg-surface text-sage-800 border-2 border-sage-400 hover:bg-sage-100 hover:border-sage-500 focus:ring-sage-500",
    maybe: isSelected
      ? "bg-gold-500 text-ink hover:bg-gold-600 focus:ring-gold-500 shadow-lg scale-105"
      : "bg-surface text-gold-900 border-2 border-gold-300 hover:bg-gold-100 hover:border-gold-500 focus:ring-gold-500",
    no: isSelected
      ? "bg-danger-600 text-ground hover:bg-danger-700 focus:ring-danger-500 shadow-lg scale-105"
      : "bg-surface text-danger-700 border-2 border-danger-300 hover:bg-danger-100 hover:border-danger-500 focus:ring-danger-500"
  };

  const labels = {
    yes: t('voteYes'),
    maybe: t('voteMaybe'),
    no: t('voteNo')
  };

  return (
    <button
      onClick={() => onClick(response)}
      disabled={loading}
      className={`${baseClasses} ${variantClasses[response]} disabled:opacity-50 disabled:cursor-not-allowed relative`}
    >
      {loading && isSelected ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {t('saving')}
        </span>
      ) : (
        labels[response]
      )}
    </button>
  );
}

export default VoteButton;
