import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Hash, ArrowLeft, RefreshCw } from 'lucide-react';
import { PostCard } from '../../components/feed/PostCard';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Post } from '../../types';
import { postService } from '../../services';
import { useLanguage } from '../../context/LanguageContext';

export const HashtagPage: React.FC = () => {
  const { tag } = useParams<{ tag: string }>();
  const { t } = useLanguage();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const cleanTag = tag?.replace('#', '') || '';

  const fetchTaggedPosts = useCallback(async () => {
    if (!cleanTag) return;
    setLoading(true);
    try {
      const data = await postService.searchPosts(`#${cleanTag}`);
      setPosts(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [cleanTag]);

  useEffect(() => {
    fetchTaggedPosts();
  }, [fetchTaggedPosts]);

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-surface/85 backdrop-blur-md border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/explore"
              className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
              aria-label={t('backToExplore')}
            >
              <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
                <Hash className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-black text-fg tracking-tight" dir="ltr">#{cleanTag}</h1>
                <span className="text-xs text-fg-muted">
                  {posts.length} {t('posts')}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={fetchTaggedPosts}
            className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
            title={t('refresh')}
            aria-label={t('refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-5 rounded-2xl bg-surface border border-border space-y-3 shadow-card">
                <Skeleton className="w-1/3 h-4 rounded" />
                <Skeleton className="w-full h-16 rounded-xl" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={<Hash className="w-6 h-6" />}
            title={`${t('postsTaggedWith')} #${cleanTag}`}
            description={t('hashtagEmptyHint')}
          />
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onPostUpdated={(updated) =>
                setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
              }
              onPostDeleted={(deletedId) =>
                setPosts((prev) => prev.filter((p) => p.id !== deletedId))
              }
            />
          ))
        )}
      </div>
    </div>
  );
};
