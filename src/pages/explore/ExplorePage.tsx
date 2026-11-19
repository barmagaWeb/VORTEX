import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, TrendingUp, Users, Compass } from 'lucide-react';
import { Tabs } from '../../components/ui/Tabs';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PostCard } from '../../components/feed/PostCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { postService, userService, communityService } from '../../services';
import { Post, User, Community } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';

export const ExplorePage: React.FC = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<'all' | 'posts' | 'people' | 'communities'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(false);

  const categories = [
    'All',
    'Technology',
    'Design & Art',
    'Photography',
    'Science & Future',
  ];

  const handleSearch = async (searchTerm: string) => {
    setLoading(true);
    try {
      const [fetchedPosts, fetchedUsers, fetchedComms] = await Promise.all([
        postService.searchPosts(searchTerm),
        userService.searchUsers(searchTerm),
        communityService.searchCommunities(searchTerm),
      ]);
      setPosts(fetchedPosts);
      setUsers(fetchedUsers);
      setCommunities(fetchedComms);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      handleSearch(initialQuery);
    } else {
      // Default explore feed
      const fetchDefaults = async () => {
        setLoading(true);
        try {
          const [allPosts, allUsers, allComms] = await Promise.all([
            postService.getFeed('forYou'),
            userService.getSuggestedUsers(6),
            communityService.getCommunities(),
          ]);
          setPosts(allPosts);
          setUsers(allUsers);
          setCommunities(allComms);
        } finally {
          setLoading(false);
        }
      };
      fetchDefaults();
    }
  }, [initialQuery]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams(query.trim() ? { q: query.trim() } : {});
    handleSearch(query.trim());
  };

  const handleFollowUser = async (userId: string, name: string) => {
    try {
      const res = await userService.toggleFollow(userId);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isFollowing: res.isFollowing, isFollowPending: Boolean(res.isPending) } : u))
      );
      showToast(res.isPending ? t('followRequestSent') : res.isFollowing ? `Followed ${name}` : `Unfollowed ${name}`);
    } catch {
      showToast('Could not follow user', 'error');
    }
  };

  const tabs = [
    { id: 'all', label: 'Top' },
    { id: 'posts', label: t('postsTab') },
    { id: 'people', label: t('peopleTab') },
    { id: 'communities', label: t('communitiesTab') },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 p-4 space-y-3">
        <form onSubmit={handleFormSubmit} className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full bg-slate-900/90 text-slate-100 placeholder-slate-500 text-sm rounded-full border border-slate-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 ps-10 pe-4 py-2.5 outline-none"
          />
        </form>

        {/* Categories scrollable pill row */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(tab) => {
            if (tab === 'all' || tab === 'posts' || tab === 'people' || tab === 'communities') setActiveTab(tab);
          }}
        />
      </div>

      {/* Content Container */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* If People tab or All */}
        {(activeTab === 'people' || (activeTab === 'all' && users.length > 0)) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <h3 className="font-bold text-sm text-slate-100">{t('peopleTab')}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <Link to={`/profile/${u.username}`} className="flex items-center gap-2.5 min-w-0">
                    <Avatar src={u.avatar} alt={u.name} size="md" />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-white truncate">{u.name}</span>
                        {u.verified && <Badge variant="verified" size="sm" />}
                      </div>
                      <span className="text-[11px] text-slate-500 truncate">@{u.username}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 truncate">{u.bio}</span>
                    </div>
                  </Link>

                  <Button
                    onClick={() => handleFollowUser(u.id, u.name)}
                    variant={u.isFollowing || u.isFollowPending ? 'secondary' : 'primary'}
                    size="sm"
                    className="text-xs px-3 py-1 shrink-0"
                  >
                    {u.isFollowPending ? t('requested') : u.isFollowing ? t('unfollow') : t('follow')}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* If Communities tab or All */}
        {(activeTab === 'communities' || (activeTab === 'all' && communities.length > 0)) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-violet-400" />
              <h3 className="font-bold text-sm text-slate-100">{t('communitiesTab')}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {communities.map((comm) => (
                <div
                  key={comm.id}
                  className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar src={comm.avatar} alt={comm.name} size="md" />
                    <div className="min-w-0">
                      <Link
                        to={`/communities/${comm.slug}`}
                        className="text-xs font-bold text-white hover:text-violet-400 transition-colors block truncate"
                      >
                        {comm.name}
                      </Link>
                      <span className="text-[11px] text-slate-500 block">
                        {comm.memberCount.toLocaleString()} members · {comm.category}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{comm.description}</p>
                  <Link to={`/communities/${comm.slug}`} className="w-full">
                    <Button variant="outline" size="sm" fullWidth className="text-xs">
                      View Community
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* If Posts tab or All */}
        {loading ? (
          <div className="text-xs text-slate-500 py-6 text-center">Searching VORTEX...</div>
        ) : (activeTab === 'posts' || activeTab === 'all') && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-slate-100">{t('postsTab')}</h3>
            </div>
            {posts.length === 0 ? (
              <EmptyState
                icon={<Search className="w-6 h-6" />}
                title="No results found"
                description={`We couldn't find any results matching "${query}". Try searching for #photography, #design, or technology.`}
              />
            ) : (
              posts.map((post) => <PostCard key={post.id} post={post} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
};
