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
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Spam or misleading');

  const isAuthor = user?.id === post.author.id;

  const handleToggleLike = async () => {
    try {
      const res = await postService.toggleLike(post.id);
      setIsLiked(res.isLiked);
      setLikesCount(res.likesCount);
      if (res.isLiked) {
        showToast('Liked post ❤️');
      }
    } catch {
      showToast('Could not like post', 'error');
    }
  };

  const handleToggleRepost = async () => {
    try {
      const res = await postService.toggleRepost(post.id);
      setIsReposted(res.isReposted);
      setRepostsCount(res.repostsCount);
      showToast(res.isReposted ? 'Reposted to your feed! 🔁' : 'Removed repost');
    } catch {
      showToast('Could not repost', 'error');
    }
  };

  const handleToggleBookmark = async () => {
    try {
      const bookmarked = await postService.toggleBookmark(post.id);
      setIsBookmarked(bookmarked);
      showToast(bookmarked ? 'Saved to Bookmarks 🔖' : 'Removed from Bookmarks');
    } catch {
      showToast('Could not update bookmark', 'error');
    }
  };

  const handleSaveEdit = async () => {
    try {
      const updated = await postService.updatePost(post.id, editContent);
      setIsEditing(false);
      showToast('Post updated');
      if (onPostUpdated) onPostUpdated(updated);
    } catch {
      showToast('Failed to update post', 'error');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await postService.deletePost(post.id);
        showToast('Post deleted');
        if (onPostDeleted) onPostDeleted(post.id);
      } catch {
        showToast('Failed to delete post', 'error');
      }
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText?.(`${window.location.origin}/post/${post.id}`);
    showToast('Link copied to clipboard!');
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
      showToast('Report submitted for review. Thank you for keeping VORTEX safe.');
    } catch {
      showToast('Failed to submit report', 'error');
    }
  };

  // Highlight hashtags nicely
  const renderFormattedContent = (text: string) => {
    const parts = text.split(/(\s+)/);
    return parts.map((part, index) => {
      if (part.startsWith('#') && part.length > 1) {
        const cleanTag = part.replace(/^#+/, '');
        return (
          <Link
            key={index}
            to={`/hashtag/${encodeURIComponent(cleanTag)}`}
            className="text-violet-400 hover:text-violet-300 font-semibold transition-colors"
          >
            {part}
          </Link>
        );
      }
      return part;
    });
  };

  return (
    <article className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-card-dark select-none">
      {/* Community badge if posted in community */}
      {post.communityName && (
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mb-2.5 pb-2 border-b border-slate-800/40">
          <Users className="w-3.5 h-3.5 text-violet-400" />
          <Link
            to={`/communities/${post.communityId || 'frontend-engineers'}`}
            className="hover:text-violet-300 transition-colors"
          >
            {post.communityName}
          </Link>
        </div>
      )}

      {/* Header matching reference image */}
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
                className="font-bold text-sm text-slate-100 hover:text-violet-300 transition-colors"
              >
                {post.author.name}
              </Link>
              {post.author.verified && <Badge variant="verified" size="sm" />}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Link to={`/profile/${post.author.username}`} className="hover:underline">
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
            aria-label="Post options"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {showMenu && (
            <div
              className="absolute end-0 mt-1 w-48 rounded-xl bg-slate-950 border border-slate-800 shadow-2xl py-1.5 z-20 text-xs"
              onClick={() => setShowMenu(false)}
            >
              <button
                onClick={handleToggleBookmark}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-slate-800/80 text-start"
              >
                <Bookmark className="w-4 h-4 text-violet-400" />
                <span>{isBookmarked ? t('removeBookmark') : t('bookmarkPost')}</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-slate-800/80 text-start"
              >
                <Copy className="w-4 h-4 text-blue-400" />
                <span>Copy Link</span>
              </button>

              {isAuthor ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-slate-800/80 text-start"
                  >
                    <Edit2 className="w-4 h-4 text-emerald-400" />
                    <span>{t('editPost')}</span>
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-400 hover:bg-rose-500/10 text-start"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t('deletePost')}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowReportModal(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-400 hover:bg-rose-500/10 text-start"
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
            className="w-full bg-slate-950 p-3 rounded-xl text-slate-100 text-sm border border-slate-700 outline-none focus:border-violet-500"
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setIsEditing(false)}
              className="text-xs px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white font-semibold"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          {post.feeling && (
            <div className="inline-block text-xs text-violet-300 font-medium bg-violet-600/15 border border-violet-500/20 px-2.5 py-0.5 rounded-full mb-2">
              {post.feeling}
            </div>
          )}
          <p className="text-sm sm:text-base text-slate-100 leading-relaxed break-words whitespace-pre-wrap">
            {renderFormattedContent(post.content)}
          </p>
        </div>
      )}

      {/* Media attachments */}
      <MediaGrid images={post.images} />

      {/* Reactions count bar matching reference image ("❤️👍 1.2K", "247 comments · 89 shares") */}
      <div className="flex items-center justify-between text-xs text-slate-400 py-2.5 mt-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <span className="flex items-center -space-x-1">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500 text-white text-[10px]">❤️</span>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[10px]">👍</span>
          </span>
          <span className="font-semibold text-slate-300">
            {likesCount > 0 ? (likesCount >= 1000 ? `${(likesCount / 1000).toFixed(1)}K` : likesCount) : '0'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span>{commentsCount} comments</span>
          <span>·</span>
          <span>{repostsCount} shares</span>
        </div>
      </div>

      {/* Action buttons row matching reference image */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handleToggleLike}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
            isLiked
              ? 'text-rose-500 hover:text-rose-400 bg-rose-500/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
          <span>{t('like')}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
            showComments
              ? 'text-violet-400 bg-violet-600/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>{t('comment')}</span>
        </button>

        <button
          onClick={handleToggleRepost}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
            isReposted
              ? 'text-emerald-400 bg-emerald-500/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Repeat2 className="w-4 h-4" />
          <span>{t('share')}</span>
        </button>

        <button
          onClick={handleToggleBookmark}
          className={`p-2 rounded-xl transition-colors ${
            isBookmarked
              ? 'text-violet-400 bg-violet-600/15'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title={isBookmarked ? t('removeBookmark') : t('bookmarkPost')}
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Flag className="w-4 h-4 text-rose-400" />
              <span>Report Post</span>
            </h3>
            <p className="text-xs text-slate-400">
              Select the reason for reporting this post to VORTEX Trust & Safety:
            </p>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-xl border border-slate-700 outline-none"
            >
              <option value="Spam or misleading">Spam or misleading</option>
              <option value="Harassment or hate speech">Harassment or hate speech</option>
              <option value="Copyright violation">Copyright violation</option>
              <option value="Inappropriate visual media">Inappropriate visual media</option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowReportModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                className="px-4 py-1.5 rounded-lg text-xs bg-rose-600 text-white font-semibold hover:bg-rose-500"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};
