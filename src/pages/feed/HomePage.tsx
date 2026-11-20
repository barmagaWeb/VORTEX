import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Users, Clock, RefreshCw } from 'lucide-react';
import { CreatePostCard } from '../../components/feed/CreatePostCard';
import { PostCard } from '../../components/feed/PostCard';
import { Tabs } from '../../components/ui/Tabs';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { StoriesBar } from '../../components/stories/StoriesBar';
import { postService } from '../../services';
import { Post } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';

export const HomePage: React.FC = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'forYou' | 'following' | 'latest'>('latest');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const hasLoadedFeed = useRef(false);
  const requestVersion = useRef(0);

  const fetchPosts = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!hasLoadedFeed.current) setLoading(true);
    try {
      const data = await postService.getFeed(activeTab);
      if (version !== requestVersion.current) return;
      setPosts(data);
      setHasNewPosts(false);
      hasLoadedFeed.current = true;
    } catch (error) {
      if (version !== requestVersion.current) return;
      console.error('Failed to load feed:', error);
      showToast(t('feedLoadFailed'), 'error');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [activeTab, showToast, t]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    let refreshTimer = 0;
    const unsubscribe = postService.subscribeToFeed(() => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => setHasNewPosts(true), 250);
    });
    return () => {
      window.clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, []);

  // Listen to global post creation events
  useEffect(() => {
    const handleGlobalPostCreated = () => {
      fetchPosts();
    };
    window.addEventListener('vortex:post_created', handleGlobalPostCreated);
    return () => window.removeEventListener('vortex:post_created', handleGlobalPostCreated);
  }, [fetchPosts]);

  const handlePostCreated = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev.filter((post) => post.id !== newPost.id)]);
  };

  const handlePostUpdated = (updated: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handlePostDeleted = (deletedId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== deletedId));
  };

  const feedTabs = [
    { id: 'forYou', label: t('forYou'), icon: <Sparkles className="w-4 h-4 text-primary" /> },
    { id: 'following', label: t('following'), icon: <Users className="w-4 h-4 text-blue-500" /> },
    { id: 'latest', label: t('latest'), icon: <Clock className="w-4 h-4 text-emerald-500" /> },
  ];

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* Sticky Feed Header with Tabs */}
      <div className="sticky top-0 z-20 bg-surface/85 backdrop-blur-md border-b border-border">
        <div className="px-4 pt-3 flex items-center justify-between">
          <h1 className="text-lg font-black text-fg tracking-tight">{t('home')}</h1>
          <div className="flex items-center gap-2">
            {hasNewPosts && (
              <button
                type="button"
                onClick={fetchPosts}
                className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary-text hover:bg-primary/20 transition-colors"
              >
                {t('newPostsAvailable')}
              </button>
            )}
            <button
              type="button"
              onClick={fetchPosts}
              className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
              title={t('refreshFeed')}
              aria-label={t('refreshFeed')}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <Tabs
          tabs={feedTabs}
          activeTab={activeTab}
          onChange={(tab) => {
            if (tab === 'forYou' || tab === 'following' || tab === 'latest') setActiveTab(tab);
          }}
          className="px-2"
        />
      </div>

      {/* Stories Bar */}
      <StoriesBar />

      {/* Main Feed Container */}
      <div className="p-4 sm:p-6 space-y-5">
        {/* Post Composer */}
        <CreatePostCard onPostCreated={handlePostCreated} />

        {/* Posts stream */}
        {loading ? (
          <div className="space-y-4 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-5 rounded-2xl bg-surface border border-border space-y-3 shadow-card">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="w-1/3 h-3.5 rounded" />
                    <Skeleton className="w-1/4 h-2.5 rounded" />
                  </div>
                </div>
                <Skeleton className="w-full h-16 rounded-xl" />
                <Skeleton className="w-full h-48 rounded-xl" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="w-6 h-6" />}
            title={t('noPostsFound')}
            description={t('startFollowingPrompt')}
          />
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onPostUpdated={handlePostUpdated}
                onPostDeleted={handlePostDeleted}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
