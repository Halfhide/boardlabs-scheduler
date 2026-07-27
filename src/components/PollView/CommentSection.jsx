import { useState } from 'react';
import { format } from 'date-fns';
import { useTranslation } from '../../i18n/useTranslation';

function CommentSection({ comments, dateId, voterName, onComment }) {
  const { t, dateLocale } = useTranslation();
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!commentText.trim() || !voterName) return;

    setLoading(true);
    setSubmitError(false);
    try {
      await onComment(dateId, commentText.trim());
      setCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
      setSubmitError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Existing Comments */}
      {comments.length > 0 && (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-ground rounded-md p-3">
              <div className="flex justify-between items-start mb-1">
                <span className="font-medium text-sm text-ink">
                  {comment.voterName}
                </span>
                <span className="text-xs text-neutral-600">
                  {comment.timestamp?.toDate
                    ? format(comment.timestamp.toDate(), t('commentTimeFormat'), { locale: dateLocale })
                    : t('justNow')}
                </span>
              </div>
              <p className="text-sm text-neutral-800">{comment.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={t('addCommentPlaceholder')}
          className="flex-1 px-4 py-2 border border-neutral-400 rounded-full text-sm focus:ring-2 focus:ring-terra focus:border-transparent"
          disabled={loading || !voterName}
        />
        <button
          type="submit"
          disabled={loading || !commentText.trim() || !voterName}
          className="px-4 py-2 bg-terra text-ground text-sm font-medium rounded-full hover:bg-terra-600 focus:outline-none focus:ring-2 focus:ring-terra focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? t('sending') : t('send')}
        </button>
      </form>

      {submitError && (
        <p className="text-xs text-danger-600">
          {t('commentFailed')}
        </p>
      )}

      {!voterName && (
        <p className="text-xs text-neutral-600 italic">
          {t('enterNameToComment')}
        </p>
      )}
    </div>
  );
}

export default CommentSection;
