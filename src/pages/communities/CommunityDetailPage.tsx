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
      showToast(res.isMember ? `Joined ${community.name}!` : `Left ${community.name}`);
    } catch {
      showToast('Could not update membership', 'error');
    }
  };

  const handlePostCreated = (newPost: Post) => {
    setPosts([newPost, ...posts]);
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 text-xs">Loading community...</div>;
  }

  if (!community) {
    return (
      <EmptyState
        title="Community not found"
        description="The community you are looking for does not exist or has been archived."
        action={
          <Link to="/communities">
            <Button variant="outline" size="sm">
              Back to Communities
            </Button>
          </Link>
        }
        className="m-6"
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Banner */}
      <div className="relative h-44 sm:h-56 w-full bg-slate-900 overflow-hidden">
        <img
          src={community.coverImage}
          alt={community.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
        <Link
          to="/communities"
          className="absolute top-4 start-4 p-2 rounded-xl bg-slate-950/60 backdrop-blur-md text-slate-200 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </div>

      {/* Header Info */}
      <div className="px-5 sm:px-8 pb-5 relative -mt-12 sm:-mt-16 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800/80">
        <div className="flex items-end gap-3.5">
          <Avatar
            src={community.avatar}
            alt={community.name}
            size="xl"
            className="ring-4 ring-slate-950 shadow-2xl"
          />
          <div className="flex flex-col">
            <h1 className="text-xl sm:text-2xl font-black text-white">{community.name}</h1>
            <span className="text-xs text-slate-400">
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
              showToast('Link copied to clipboard!');
            }}
            className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Feed + Rules Sidebar */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* Description card */}
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/70 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {community.description}
        </div>

        {/* Community Rules */}
        {community.rules && community.rules.length > 0 && (
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-violet-300 uppercase tracking-wider">
              <BookOpen className="w-4 h-4" />
              <span>{t('communityRules')}</span>
            </div>
            <ul className="space-y-1.5 pt-1">
              {community.rules.map((rule, idx) => (
                <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                  <span className="text-violet-400 font-bold shrink-0">{idx + 1}.</span>
                  <span>{rule}</span>
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
          <h3 className="font-bold text-sm text-slate-200">Discussions</h3>
          {posts.length === 0 ? (
            <EmptyState
              title="No posts in this community yet"
              description="Start the first discussion above!"
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
