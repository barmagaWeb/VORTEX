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
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [replySubmitting, setReplySubmitting] = useState(false);

  const getUsernameLabel = (username: string, fallback: string) =>
    username ? `@${username.replace(/^@/, '')}` : fallback;

  useEffect(() => {
    let active = true;
    const fetchComments = async () => {
      try {
        const data = await postService.getComments(postId);
        if (active) setComments(data);
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchComments();
    return () => { active = false; };
  }, [postId]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newCommentText.trim();
    if (!content || !user || commentSubmitting) return;

    const temporaryId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticComment: Comment = {
      id: temporaryId,
      postId,
      author: user,
      content,
      createdAt: new Date().toLocaleString(),
      likesCount: 0,
      replies: [],
    };

    setComments((prev) => [...prev, optimisticComment]);
    setNewCommentText('');
    setCommentSubmitting(true);
    onCommentCountChange?.(comments.length + 1);

    try {
      const added = await postService.addComment(postId, content);
      setComments((prev) => prev.map((comment) => comment.id === temporaryId ? added : comment));
      showToast(t('toastCommentAdded'));
    } catch {
      setComments((prev) => prev.filter((comment) => comment.id !== temporaryId));
      onCommentCountChange?.(Math.max(0, comments.length));
      setNewCommentText(content);
      showToast(t('toastCommentFailed'), 'error');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleAddReply = async (parentCommentId: string) => {
    const content = replyText.trim();
    if (!content || !user || replySubmitting) return;

    const temporaryId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticReply: Comment = {
      id: temporaryId,
      postId,
      author: user,
      content,
      createdAt: new Date().toLocaleString(),
      likesCount: 0,
    };

    setComments((prev) => prev.map((comment) =>
      comment.id === parentCommentId
        ? { ...comment, replies: [...(comment.replies || []), optimisticReply] }
        : comment
    ));
    setReplyText('');
    setReplySubmitting(true);

    try {
      const addedReply = await postService.addComment(postId, content, parentCommentId);
      setComments((prev) => prev.map((comment) =>
        comment.id === parentCommentId
          ? { ...comment, replies: (comment.replies || []).map((reply) => reply.id === temporaryId ? addedReply : reply) }
          : comment
      ));
      setReplyToId(null);
      showToast(t('toastReplyAdded'));
    } catch {
      setComments((prev) => prev.map((comment) =>
        comment.id === parentCommentId
          ? { ...comment, replies: (comment.replies || []).filter((reply) => reply.id !== temporaryId) }
          : comment
      ));
      setReplyText(content);
      showToast(t('toastReplyFailed'), 'error');
    } finally {
      setReplySubmitting(false);
    }
  };

  return (
    <div className="pt-3 border-t border-border space-y-4">
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
            dir="auto"
            className="w-full bg-surface text-fg text-xs sm:text-sm rounded-full px-4 py-2 pe-10 border border-border focus:border-primary focus:ring-1 focus:ring-primary/40 outline-none transition-all placeholder:text-fg-subtle"
          />
          <button
            type="submit"
            disabled={!newCommentText.trim() || commentSubmitting || !user}
            className="absolute end-1.5 p-1.5 rounded-full text-primary-text hover:text-primary-hover disabled:opacity-40 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label={t('sendComment')}
          >
            <Send className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>
      </form>

      {/* Comments list */}
      {loading ? (
        <div className="text-xs text-fg-subtle py-2">{t('loadingComments')}</div>
      ) : comments.length === 0 ? (
        <div className="text-xs text-fg-subtle text-center py-2">{t('noCommentsYet')}</div>
      ) : (
        <div className="space-y-3.5 pt-1">
          {comments.map((comment) => (
            <div key={comment.id} className="space-y-2 text-start">
              <div className="flex gap-2.5 items-start">
                <Avatar src={comment.author.avatar} alt={getUsernameLabel(comment.author.username, comment.author.name)} size="sm" />
                <div className="flex-1 bg-surface-elevated/70 rounded-2xl p-3 border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-fg"><bdi>{getUsernameLabel(comment.author.username, comment.author.name)}</bdi></span>
                    <span className="text-[10px] text-fg-subtle">{comment.createdAt}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-fg-muted mt-1 leading-relaxed" dir="auto">
                    {comment.content}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-fg-muted">
                    <button
                      onClick={() => {
                        comment.isLiked = !comment.isLiked;
                        comment.likesCount += comment.isLiked ? 1 : -1;
                        setComments([...comments]);
                      }}
                      className={`flex items-center gap-1 hover:text-rose-500 transition-colors ${
                        comment.isLiked ? 'text-rose-500 font-semibold' : ''
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${comment.isLiked ? 'fill-current' : ''}`} />
                      <span>{comment.likesCount > 0 ? comment.likesCount : t('like')}</span>
                    </button>

                    <button
                      onClick={() => setReplyToId(replyToId === comment.id ? null : comment.id)}
                      className="flex items-center gap-1 hover:text-primary-text transition-colors"
                    >
                      <Reply className="w-3.5 h-3.5 rtl:-scale-x-100" />
                      <span>{t('reply')}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Reply form */}
              {replyToId === comment.id && (
                <div className="ms-10 flex items-center gap-2 pt-1">
                  <CornerDownRight className="w-3.5 h-3.5 text-fg-subtle rtl:rotate-180" />
                  <input
                    type="text"
                    value={replyText}
                    maxLength={5000}
                    onChange={(e) => setReplyText(e.target.value.slice(0, 5000))}
                    placeholder={t('replyToPlaceholder', { name: getUsernameLabel(comment.author.username, comment.author.name) })}
                    dir="auto"
                    className="flex-1 bg-surface text-xs text-fg rounded-full px-3 py-1.5 border border-border outline-none focus:border-primary placeholder:text-fg-subtle"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() => void handleAddReply(comment.id)}
                    disabled={!replyText.trim() || replySubmitting || !user}
                    className="text-xs px-3 py-1"
                  >
                    {t('reply')}
                  </Button>
                </div>
              )}

              {/* Threaded replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="ms-10 space-y-2 border-s-2 border-border ps-3">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="flex gap-2 items-start">
                      <Avatar src={reply.author.avatar} alt={getUsernameLabel(reply.author.username, reply.author.name)} size="xs" />
                      <div className="flex-1 bg-surface rounded-xl p-2.5 border border-border">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-fg"><bdi>{getUsernameLabel(reply.author.username, reply.author.name)}</bdi></span>
                          <span className="text-[10px] text-fg-subtle">{reply.createdAt}</span>
                        </div>
                        <p className="text-xs text-fg-muted mt-0.5" dir="auto">{reply.content}</p>
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
