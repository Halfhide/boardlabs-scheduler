import { useState } from 'react';
import { format } from 'date-fns';

function CommentSection({ comments, dateId, voterName, onComment }) {
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
            <div key={comment.id} className="bg-gray-50 rounded-md p-3">
              <div className="flex justify-between items-start mb-1">
                <span className="font-medium text-sm text-gray-900">
                  {comment.voterName}
                </span>
                <span className="text-xs text-gray-500">
                  {comment.timestamp?.toDate
                    ? format(comment.timestamp.toDate(), 'MMM d, h:mm a')
                    : 'Just now'}
                </span>
              </div>
              <p className="text-sm text-gray-700">{comment.text}</p>
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
          placeholder="Add a comment..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading || !voterName}
        />
        <button
          type="submit"
          disabled={loading || !commentText.trim() || !voterName}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </form>

      {submitError && (
        <p className="text-xs text-red-600">
          Failed to add comment. Please try again.
        </p>
      )}

      {!voterName && (
        <p className="text-xs text-gray-500 italic">
          Please enter your name to add comments
        </p>
      )}
    </div>
  );
}

export default CommentSection;
