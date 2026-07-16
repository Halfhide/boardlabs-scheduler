import { useTranslation } from '../../i18n/useTranslation';

function VoteButton({ response, currentVote, onClick, loading }) {
  const { t } = useTranslation();
  const isSelected = currentVote === response;

  const baseClasses = "flex-1 py-3 px-6 rounded-md font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 text-lg";

  const variantClasses = {
    yes: isSelected
      ? "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 shadow-lg scale-105"
      : "bg-white text-green-700 border-2 border-green-300 hover:bg-green-50 hover:border-green-400 focus:ring-green-500",
    maybe: isSelected
      ? "bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500 shadow-lg scale-105"
      : "bg-white text-yellow-700 border-2 border-yellow-300 hover:bg-yellow-50 hover:border-yellow-400 focus:ring-yellow-500",
    no: isSelected
      ? "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-lg scale-105"
      : "bg-white text-red-700 border-2 border-red-300 hover:bg-red-50 hover:border-red-400 focus:ring-red-500"
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
