import React, { useState, useEffect } from 'react';
import { Heart, Reply, Send, CornerDownRight } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { postService } from '../../services';
import { Comment } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';

interface PostCommentsProps {
  postId: string;
  onCommentCountChange?: (newCount: number) => void;
}

export const PostComments: React.FC<PostCommentsProps> = ({ postId, onCommentCountChange }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const data = await postService.getComments(postId);
        setComments(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchComments();
  }, [postId]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    try {
      const added = await postService.addComment(postId, newCommentText.trim());
      const updated = [...comments, added];
      setComments(updated);
      setNewCommentText('');
      if (onCommentCountChange) {
        onCommentCountChange(updated.length);
      }
      showToast('Comment added!');
    } catch {
      showToast('Failed to add comment', 'error');
    }
  };

  const handleAddReply = async (parentCommentId: string) => {
    if (!replyText.trim()) return;

    try {
      const addedReply = await postService.addComment(postId, replyText.trim(), parentCommentId);
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === parentCommentId) {
            return {
              ...c,
              replies: [...(c.replies || []), addedReply],
            };
          }
          return c;
        })
      );
      setReplyText('');
      setReplyToId(null);
      showToast('Reply added!');
    } catch {
      showToast('Failed to add reply', 'error');
    }
  };

  return (
    <div className="pt-3 border-t border-slate-800/80 space-y-4">
      {/* New comment input */}
      <form onSubmit={handleAddComment} className="flex items-center gap-2.5">
        <Avatar src={user?.avatar} alt={user?.name || 'Me'} size="sm" />
        <div className="flex-1 relative flex items-center">
          <input
            type="text"
            value={newCommentText}
            maxLength={5000}
            onChange={(e) => setNewCommentText(e.target.value.slice(0, 5000))}
            placeholder={t('writeComment')}
            className="w-full bg-slate-950/70 text-slate-100 text-xs sm:text-sm rounded-full px-4 py-2 pe-10 border border-slate-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
          />
          <button
            type="submit"
            disabled={!newCommentText.trim()}
            className="absolute end-1.5 p-1.5 rounded-full text-violet-400 hover:text-violet-300 disabled:opacity-40 disabled:hover:text-violet-400 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Comments list */}
      {loading ? (
        <div className="text-xs text-slate-500 py-2">Loading discussions...</div>
      ) : comments.length === 0 ? (
        <div className="text-xs text-slate-500 text-center py-2">No comments yet. Be the first to start the conversation!</div>
      ) : (
        <div className="space-y-3.5 pt-1">
          {comments.map((comment) => (
            <div key={comment.id} className="space-y-2 text-start">
              <div className="flex gap-2.5 items-start">
                <Avatar src={comment.author.avatar} alt={comment.author.name} size="sm" />
                <div className="flex-1 bg-slate-950/50 rounded-2xl p-3 border border-slate-800/60">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">{comment.author.name}</span>
                    <span className="text-[10px] text-slate-500">{comment.createdAt}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                    {comment.content}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400">
                    <button
                      onClick={() => {
                        comment.isLiked = !comment.isLiked;
                        comment.likesCount += comment.isLiked ? 1 : -1;
                        setComments([...comments]);
                      }}
                      className={`flex items-center gap-1 hover:text-rose-400 transition-colors ${
                        comment.isLiked ? 'text-rose-400 font-semibold' : ''
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${comment.isLiked ? 'fill-current' : ''}`} />
                      <span>{comment.likesCount > 0 ? comment.likesCount : t('like')}</span>
                    </button>

                    <button
                      onClick={() => setReplyToId(replyToId === comment.id ? null : comment.id)}
                      className="flex items-center gap-1 hover:text-violet-400 transition-colors"
                    >
                      <Reply className="w-3.5 h-3.5" />
                      <span>{t('reply')}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Reply form */}
              {replyToId === comment.id && (
                <div className="ms-10 flex items-center gap-2 pt-1">
                  <CornerDownRight className="w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={replyText}
                    maxLength={5000}
                    onChange={(e) => setReplyText(e.target.value.slice(0, 5000))}
                    placeholder={`Reply to ${comment.author.name}...`}
                    className="flex-1 bg-slate-900 text-xs text-slate-100 rounded-full px-3 py-1.5 border border-slate-700 outline-none focus:border-violet-500"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() => handleAddReply(comment.id)}
                    disabled={!replyText.trim()}
                    className="text-xs px-3 py-1"
                  >
                    Reply
                  </Button>
                </div>
              )}

              {/* Threaded replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="ms-10 space-y-2 border-s-2 border-slate-800/80 ps-3">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="flex gap-2 items-start">
                      <Avatar src={reply.author.avatar} alt={reply.author.name} size="xs" />
                      <div className="flex-1 bg-slate-950/40 rounded-xl p-2.5 border border-slate-800/40">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200">{reply.author.name}</span>
                          <span className="text-[10px] text-slate-500">{reply.createdAt}</span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">{reply.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
