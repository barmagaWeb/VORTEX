import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  MoreHorizontal,
  Edit2,
  Trash2,
  Flag,
  Copy,
  Users,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { MediaGrid } from './MediaGrid';
import { PostComments } from './PostComments';
import { Post } from '../../types';
import { postService, adminService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';

interface PostCardProps {
  post: Post;
  onPostUpdated?: (updated: Post) => void;
  onPostDeleted?: (postId: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onPostUpdated,
  onPostDeleted,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [isReposted, setIsReposted] = useState(post.isReposted || false);
  const [repostsCount, setRepostsCount] = useState(post.repostsCount || 0);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked || false);
  const [likePending, setLikePending] = useState(false);
  const [repostPending, setRepostPending] = useState(false);
  const [bookmarkPending, setBookmarkPending] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Spam or misleading');

  const isAuthor = user?.id === post.author.id;

  const handleToggleLike = async () => {
    if (likePending) return;
    const previousLiked = isLiked;
    const previousCount = likesCount;
    const nextLiked = !previousLiked;

    // Update the interface immediately; persist the change in the background.
    setIsLiked(nextLiked);
    setLikesCount(Math.max(0, previousCount + (nextLiked ? 1 : -1)));
    setLikePending(true);

    try {
      const res = await postService.toggleLike(post.id);
      setIsLiked(res.isLiked);
      setLikesCount(res.likesCount);
    } catch {
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
      showToast(t('toastLikeFailed'), 'error');
    } finally {
      setLikePending(false);
    }
  };

  const handleToggleRepost = async () => {
    if (repostPending) return;
    const previousReposted = isReposted;
    const previousCount = repostsCount;
    const nextReposted = !previousReposted;

    setIsReposted(nextReposted);
    setRepostsCount(Math.max(0, previousCount + (nextReposted ? 1 : -1)));
    setRepostPending(true);

    try {
      const res = await postService.toggleRepost(post.id);
      setIsReposted(res.isReposted);
      setRepostsCount(res.repostsCount);
    } catch {
      setIsReposted(previousReposted);
      setRepostsCount(previousCount);
      showToast(t('toastRepostFailed'), 'error');
    } finally {
      setRepostPending(false);
    }
  };

  const handleToggleBookmark = async () => {
    if (bookmarkPending) return;
    const previousBookmarked = isBookmarked;
    const nextBookmarked = !previousBookmarked;

    setIsBookmarked(nextBookmarked);
    setBookmarkPending(true);

    try {
      const bookmarked = await postService.toggleBookmark(post.id);
      setIsBookmarked(bookmarked);
    } catch {
      setIsBookmarked(previousBookmarked);
      showToast(t('toastBookmarkFailed'), 'error');
    } finally {
      setBookmarkPending(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      const updated = await postService.updatePost(post.id, editContent);
      setIsEditing(false);
      showToast(t('toastPostUpdated'));
      if (onPostUpdated) onPostUpdated(updated);
    } catch {
      showToast(t('toastPostUpdateFailed'), 'error');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await postService.deletePost(post.id);
        showToast(t('toastPostDeleted'));
        if (onPostDeleted) onPostDeleted(post.id);
      } catch {
        showToast(t('toastPostDeleteFailed'), 'error');
      }
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText?.(`${window.location.origin}/post/${post.id}`);
    showToast(t('toastLinkCopied'));
    setShowMenu(false);
  };

  const handleSubmitReport = async () => {
    try {
      await adminService.submitReport(
        'post',
        post.id,
        post.content.slice(0, 80),
        reportReason
      );
      setShowReportModal(false);
      showToast(t('toastReportSubmitted'));
    } catch {
      showToast(t('toastReportFailed'), 'error');
    }
  };

  const renderFormattedContent = (text: string) => {
    const parts = text.split(/(\s+)/);
    return parts.map((part, index) => {
      if (part.startsWith('#') && part.length > 1) {
        const cleanTag = part.replace(/^#+/, '');
        return (
          <Link
            key={index}
            to={`/hashtag/${encodeURIComponent(cleanTag)}`}
            className="text-primary-text hover:underline font-semibold transition-colors"
          >
            {part}
          </Link>
        );
      }
      return part;
    });
  };

  return (
    <article className="p-4 sm:p-5 rounded-2xl bg-surface border border-border hover:border-fg-subtle/30 transition-all shadow-card select-none">
      {/* Community badge if posted in community */}
      {post.communityName && (
        <div className="flex items-center gap-1.5 text-xs text-fg-muted font-semibold mb-2.5 pb-2 border-b border-border-subtle">
          <Users className="w-3.5 h-3.5 text-primary" />
          <Link
            to={`/communities/${post.communityId || 'frontend-engineers'}`}
            className="hover:text-primary-text transition-colors"
          >
            {post.communityName}
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${post.author.username}`}>
            <Avatar
              src={post.author.avatar}
              alt={post.author.name}
              size="md"
              isOnline={post.author.id === 'usr_me'}
            />
          </Link>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                to={`/profile/${post.author.username}`}
                className="font-bold text-sm text-fg hover:text-primary-text transition-colors"
              >
                <bdi>{post.author.name}</bdi>
              </Link>
              {post.author.verified && <Badge variant="verified" size="sm" />}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-fg-muted">
              <Link to={`/profile/${post.author.username}`} className="hover:underline" dir="ltr">
                @{post.author.username}
              </Link>
              <span>·</span>
              <span>{post.createdAt}</span>
              <span>·</span>
              <span className="capitalize">{post.visibility}</span>
            </div>
          </div>
        </div>

        {/* Post dropdown menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
            aria-label={t('postOptions')}
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {showMenu && (
            <div
              className="absolute end-0 mt-1 w-48 rounded-xl bg-surface-elevated border border-border shadow-card py-1.5 z-20 text-xs"
              onClick={() => setShowMenu(false)}
            >
              <button
                onClick={handleToggleBookmark}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-fg-muted hover:text-fg hover:bg-surface-hover text-start"
              >
                <Bookmark className="w-4 h-4 text-primary" />
                <span>{isBookmarked ? t('removeBookmark') : t('bookmarkPost')}</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-fg-muted hover:text-fg hover:bg-surface-hover text-start"
              >
                <Copy className="w-4 h-4 text-blue-500" />
                <span>{t('copyLink')}</span>
              </button>

              {isAuthor ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-fg-muted hover:text-fg hover:bg-surface-hover text-start"
                  >
                    <Edit2 className="w-4 h-4 text-emerald-500" />
                    <span>{t('editPost')}</span>
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-danger-text hover:bg-danger/10 text-start"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t('deletePost')}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowReportModal(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-danger-text hover:bg-danger/10 text-start"
                >
                  <Flag className="w-4 h-4" />
                  <span>{t('reportPost')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post text content & Feeling badge */}
      {isEditing ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full bg-surface-elevated p-3 rounded-xl text-fg text-sm border border-border outline-none focus:border-primary"
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setIsEditing(false)}
              className="text-xs px-3 py-1.5 rounded-lg text-fg-muted hover:text-fg"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSaveEdit}
              className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-fg font-semibold"
            >
              {t('save')}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          {post.feeling && (
            <div className="inline-block text-xs text-primary-text font-medium bg-primary/15 border border-primary/25 px-2.5 py-0.5 rounded-full mb-2">
              {post.feeling}
            </div>
          )}
          <p className="text-sm sm:text-base text-fg leading-relaxed break-words whitespace-pre-wrap" dir="auto">
            {renderFormattedContent(post.content)}
          </p>
        </div>
      )}

      {/* Media attachments */}
      <MediaGrid images={post.images} />

      {/* Reactions count bar */}
      <div className="flex items-center justify-between text-xs text-fg-muted py-2.5 mt-2.5 border-b border-border">
        <div className="flex items-center gap-1.5">
          <span className="flex items-center [&>*+*]:-ms-1">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500 text-white text-[10px]">❤️</span>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[10px]">👍</span>
          </span>
          <span className="font-semibold text-fg">
            {likesCount > 0 ? (likesCount >= 1000 ? `${(likesCount / 1000).toFixed(1)}K` : likesCount) : '0'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span>{commentsCount} comments</span>
          <span>·</span>
          <span>{repostsCount} shares</span>
        </div>
      </div>

      {/* Action buttons row */}
      <div className="flex items-center justify-between pt-2">
        <button
          disabled={likePending}
          onClick={handleToggleLike}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors min-h-[44px] ${
            isLiked
              ? 'text-rose-500 hover:text-rose-600 bg-rose-500/10'
              : 'text-fg-muted hover:text-fg hover:bg-surface-hover'
          }`}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
          <span>{t('like')}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors min-h-[44px] ${
            showComments
              ? 'text-primary-text bg-primary/10'
              : 'text-fg-muted hover:text-fg hover:bg-surface-hover'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>{t('comment')}</span>
        </button>

        <button
          disabled={repostPending}
          onClick={handleToggleRepost}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors min-h-[44px] ${
            isReposted
              ? 'text-emerald-500 bg-emerald-500/10'
              : 'text-fg-muted hover:text-fg hover:bg-surface-hover'
          }`}
        >
          <Repeat2 className="w-4 h-4" />
          <span>{t('share')}</span>
        </button>

        <button
          disabled={bookmarkPending}
          onClick={handleToggleBookmark}
          className={`p-2.5 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
            isBookmarked
              ? 'text-primary-text bg-primary/15'
              : 'text-fg-muted hover:text-fg hover:bg-surface-hover'
          }`}
          title={isBookmarked ? t('removeBookmark') : t('bookmarkPost')}
          aria-label={isBookmarked ? t('removeBookmark') : t('bookmarkPost')}
        >
          <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <PostComments
          postId={post.id}
          onCommentCountChange={(count) => setCommentsCount(count)}
        />
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-overlay/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-elevated border border-border rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-card">
            <h3 className="text-base font-bold text-fg flex items-center gap-2">
              <Flag className="w-4 h-4 text-danger" />
              <span>{t('reportPost')}</span>
            </h3>
            <p className="text-xs text-fg-muted">
              {t('reportDescription')}
            </p>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full bg-surface text-fg text-xs p-2.5 rounded-xl border border-border outline-none focus:border-primary"
            >
              <option value="Spam or misleading">{t('reportReasonSpam')}</option>
              <option value="Harassment or hate speech">{t('reportReasonHarassment')}</option>
              <option value="Copyright violation">{t('reportReasonCopyright')}</option>
              <option value="Inappropriate visual media">{t('reportReasonInappropriate')}</option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowReportModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-fg-muted hover:text-fg"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSubmitReport}
                className="px-4 py-1.5 rounded-lg text-xs bg-rose-600 text-white font-semibold hover:bg-rose-500"
              >
                {t('submitReport')}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};
