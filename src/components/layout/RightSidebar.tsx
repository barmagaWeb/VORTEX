import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Flame, Users, X } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { userService } from '../../services';
import { User } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';

export const RightSidebar: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJoinCard, setShowJoinCard] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const users = await userService.getSuggestedUsers(3);
        setSuggestedUsers(users);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleToggleFollow = async (userId: string, userName: string) => {
    try {
      const res = await userService.toggleFollow(userId);
      setSuggestedUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isFollowing: res.isFollowing, isFollowPending: Boolean(res.isPending) } : u))
      );
      showToast(
        res.isPending
          ? t('followRequestSent')
          : res.isFollowing
          ? `You followed ${userName}`
          : `You unfollowed ${userName}`
      );
    } catch {
      showToast('Could not update follow status', 'error');
    }
  };

  const trendingTopics = [
    { tag: 'WebGPU', postsCount: '124K' },
    { tag: 'SpatialUI', postsCount: '98K' },
    { tag: 'AI_Tools', postsCount: '87K' },
    { tag: 'TechFuture', postsCount: '76K' },
    { tag: 'VORTEX', postsCount: '62K' },
  ];

  return (
    <aside className="hidden xl:flex flex-col gap-5 w-80 lg:w-88 h-screen sticky top-0 px-4 py-5 overflow-y-auto no-scrollbar shrink-0 select-none">
      {/* Search Bar matching screenshot */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full bg-slate-900/90 text-slate-100 placeholder-slate-500 text-xs sm:text-sm rounded-full border border-slate-800/80 hover:border-slate-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 ps-10 pe-4 py-2.5 transition-all outline-none"
        />
      </form>

      {/* Trending Topics Card matching screenshot */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-500 fill-rose-500" />
            <h3 className="font-bold text-sm text-slate-100 tracking-tight">{t('trending')}</h3>
          </div>
          <Link
            to="/explore"
            className="text-xs font-semibold text-violet-400 hover:text-violet-300"
          >
            {t('viewAll')}
          </Link>
        </div>

        <div className="flex flex-col divide-y divide-slate-800/60">
          {trendingTopics.map((topic) => (
            <Link
              key={topic.tag}
              to={`/explore?q=%23${topic.tag}`}
              className="py-2.5 flex items-center justify-between hover:opacity-85 transition-opacity group"
            >
              <div className="flex flex-col text-start">
                <span className="text-sm font-bold text-slate-200 group-hover:text-violet-400 transition-colors">
                  #{topic.tag}
                </span>
                <span className="text-[11px] text-slate-500">
                  {topic.postsCount} {t('posts')}
                </span>
              </div>
              <span className="text-violet-400/80 font-mono text-sm">#</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Suggested People Card matching screenshot */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <h3 className="font-bold text-sm text-slate-100 tracking-tight">{t('whoToFollow')}</h3>
          </div>
          <Link
            to="/explore"
            className="text-xs font-semibold text-violet-400 hover:text-violet-300"
          >
            {t('viewAll')}
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-800 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-800 rounded w-2/3" />
                  <div className="h-2 bg-slate-800 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {suggestedUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-2">
                <Link
                  to={`/profile/${u.username}`}
                  className="flex items-center gap-2.5 min-w-0 group"
                >
                  <Avatar src={u.avatar} alt={u.name} size="sm" />
                  <div className="flex flex-col min-w-0 text-start">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                        {u.name}
                      </span>
                      {u.verified && <Badge variant="verified" size="sm" />}
                    </div>
                    <span className="text-[11px] text-slate-500 truncate">
                      @{u.username}
                    </span>
                  </div>
                </Link>

                <Button
                  onClick={() => handleToggleFollow(u.id, u.name)}
                  variant={u.isFollowing || u.isFollowPending ? 'secondary' : 'primary'}
                  size="sm"
                  className="text-xs px-3 py-1 shrink-0"
                >
                  {u.isFollowPending ? t('requested') : u.isFollowing ? t('unfollow') : t('follow')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Promo Card: Join VORTEX Community matching screenshot */}
      {showJoinCard && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-violet-500/30 flex items-center justify-between relative shadow-lg">
          <button
            onClick={() => setShowJoinCard(false)}
            className="absolute top-2.5 start-2.5 text-slate-500 hover:text-slate-300 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="flex flex-col text-start ps-3">
            <span className="text-xs font-bold text-white">{t('joinCommunityCardTitle')}</span>
            <span className="text-[10px] text-slate-400 mt-0.5">{t('joinCommunityCardSubtitle')}</span>
            <div className="mt-2.5">
              <Button
                onClick={() => {
                  showToast('Welcome to the official VORTEX Community Hub! 🌟');
                  navigate('/communities');
                }}
                variant="primary"
                size="sm"
                className="text-xs py-1 px-3 shadow-vortex-glow"
              >
                {t('joinNowBtn')}
              </Button>
            </div>
          </div>
          {/* Stylized V Geometric Logo */}
          <div className="w-12 h-12 flex items-center justify-center shrink-0 pe-1">
            <svg viewBox="0 0 48 48" fill="none" className="w-full h-full drop-shadow-[0_0_10px_rgba(139,92,246,0.6)]">
              <path d="M6 8 L24 42 L30 42 L42 8 L33 8 L24 28 L15 8 Z" fill="url(#sideVortex)" />
              <defs>
                <linearGradient id="sideVortex" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#A78BFA" />
                  <stop offset="0.5" stopColor="#7C3AED" />
                  <stop offset="1" stopColor="#3B82F6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="px-2 text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
        <Link to="/settings" className="hover:underline">Privacy</Link>
        <Link to="/settings" className="hover:underline">Terms</Link>
        <Link to="/explore" className="hover:underline">Explore</Link>
        <Link to="/admin" className="hover:underline">Admin</Link>
        <span className="w-full mt-1 text-slate-600">© 2026 VORTEX Inc.</span>
      </footer>
    </aside>
  );
};
