import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BookOpen,
  ArrowLeft,
  Check,
  Share2,
} from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { CreatePostCard } from '../../components/feed/CreatePostCard';
import { PostCard } from '../../components/feed/PostCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { communityService, postService } from '../../services';
import { Community, Post } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';

export const CommunityDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      try {
        if (!slug) return;
        const comm = await communityService.getCommunityBySlug(slug);
        setCommunity(comm);
        if (comm) {
          const commPosts = await postService.getFeed('forYou', comm.id);
          setPosts(commPosts);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [slug]);

  const handleToggleMembership = async () => {
    if (!community) return;
    try {
      const res = await communityService.toggleMembership(community.id);
      setCommunity({
        ...community,
        isMember: res.isMember,
        memberCount: res.memberCount,
      });
      showToast(res.isMember ? t('toastJoinedCommunity', { name: community.name }) : t('toastLeftCommunity', { name: community.name }));
    } catch {
      showToast(t('toastMembershipFailed'), 'error');
    }
  };

  const handlePostCreated = (newPost: Post) => {
    setPosts([newPost, ...posts]);
  };

  if (loading) {
    return <div className="p-8 text-center text-fg-subtle text-xs">{t('loadingCommunity')}</div>;
  }

  if (!community) {
    return (
      <EmptyState
        title={t('communityNotFound')}
        description={t('communityNotFoundDescription')}
        action={
          <Link to="/communities">
            <Button variant="outline" size="sm">
              {t('backToCommunities')}
            </Button>
          </Link>
        }
        className="m-6"
      />
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* Banner */}
      <div className="relative h-44 sm:h-56 w-full bg-surface-elevated overflow-hidden">
        <img
          src={community.coverImage}
          alt={community.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
        <Link
          to="/communities"
          className="absolute top-4 start-4 p-2 rounded-xl bg-surface/80 backdrop-blur-md text-fg hover:text-primary-text transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center shadow-sm"
          aria-label={t('backToCommunities')}
        >
          <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
        </Link>
      </div>

      {/* Header Info */}
      <div className="px-5 sm:px-8 pb-5 relative -mt-12 sm:-mt-16 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border">
        <div className="flex items-end gap-3.5">
          <Avatar
            src={community.avatar}
            alt={community.name}
            size="xl"
            className="ring-4 ring-bg shadow-2xl"
          />
          <div className="flex flex-col">
            <h1 className="text-xl sm:text-2xl font-black text-fg">
              <bdi>{community.name}</bdi>
            </h1>
            <span className="text-xs text-fg-muted">
              {community.memberCount.toLocaleString()} {t('membersCount')} · {community.category}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleToggleMembership}
            variant={community.isMember ? 'secondary' : 'primary'}
            size="md"
          >
            {community.isMember ? (
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                <span>{t('leaveCommunity')}</span>
              </span>
            ) : (
              t('joinCommunity')
            )}
          </Button>
          <button
            onClick={() => {
              navigator.clipboard?.writeText?.(window.location.href);
              showToast(t('toastLinkCopied'));
            }}
            className="p-2.5 rounded-xl bg-surface-elevated text-fg-muted hover:text-fg border border-border transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
            title={t('shareCommunity')}
            aria-label={t('shareCommunity')}
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Feed + Rules Sidebar */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* Description card */}
        <div className="p-4 rounded-2xl bg-surface border border-border text-xs sm:text-sm text-fg leading-relaxed shadow-card" dir="auto">
          {community.description}
        </div>

        {/* Community Rules */}
        {community.rules && community.rules.length > 0 && (
          <div className="p-4 rounded-2xl bg-surface border border-border space-y-2 shadow-card">
            <div className="flex items-center gap-2 text-xs font-bold text-primary-text uppercase tracking-wider">
              <BookOpen className="w-4 h-4" />
              <span>{t('communityRules')}</span>
            </div>
            <ul className="space-y-1.5 pt-1">
              {community.rules.map((rule, idx) => (
                <li key={idx} className="text-xs text-fg-muted flex items-start gap-2">
                  <span className="text-primary-text font-bold shrink-0">{idx + 1}.</span>
                  <span dir="auto">{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Post Composer for this community */}
        <CreatePostCard
          communityId={community.id}
          communityName={community.name}
          onPostCreated={handlePostCreated}
        />

        {/* Posts */}
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-fg">{t('discussions')}</h3>
          {posts.length === 0 ? (
            <EmptyState
              title={t('noCommunityPosts')}
              description={t('noCommunityPostsHint')}
            />
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onPostDeleted={(id) => setPosts(posts.filter((p) => p.id !== id))}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
