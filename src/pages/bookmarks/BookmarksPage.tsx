import React, { useState, useEffect } from 'react';
import { Bookmark, Search } from 'lucide-react';
import { PostCard } from '../../components/feed/PostCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { postService } from '../../services';
import { Post } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

export const BookmarksPage: React.FC = () => {
  const { t } = useLanguage();
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchBookmarks = async () => {
    setLoading(true);
    try {
      const posts = await postService.getBookmarkedPosts();
      setBookmarkedPosts(posts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const filtered = bookmarkedPosts.filter(
    (p) =>
      p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.author.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-violet-400" />
          <h1 className="text-lg font-black text-white">{t('savedBookmarks')}</h1>
        </div>
        <p className="text-xs text-slate-400">{t('bookmarksDescription')}</p>

        {bookmarkedPosts.length > 0 && (
          <div className="relative pt-1">
            <Search className="w-4 h-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved posts..."
              className="w-full bg-slate-900 text-slate-100 text-xs rounded-full ps-9 pe-4 py-2 border border-slate-800 focus:border-violet-500 outline-none"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 space-y-4">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Loading bookmarks...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Bookmark className="w-6 h-6" />}
            title={t('noBookmarksYet')}
            description="When you see a great post or reference you want to keep, click the bookmark icon on the post."
          />
        ) : (
          <div className="space-y-4">
            {filtered.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onPostUpdated={fetchBookmarks}
                onPostDeleted={fetchBookmarks}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
