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
    <div className="flex flex-col min-h-[100dvh]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-surface/85 backdrop-blur-md border-b border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-black text-fg">{t('savedBookmarks')}</h1>
        </div>
        <p className="text-xs text-fg-muted">{t('bookmarksDescription')}</p>

        {bookmarkedPosts.length > 0 && (
          <div className="relative pt-1">
            <Search className="w-4 h-4 text-fg-subtle absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchSavedPlaceholder')}
              className="w-full bg-surface text-fg placeholder:text-fg-subtle text-xs rounded-full ps-9 pe-4 py-2 border border-border focus:border-primary focus:ring-1 focus:ring-primary/40 outline-none transition-all"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 space-y-4">
        {loading ? (
          <div className="p-8 text-center text-fg-subtle text-xs">{t('loadingBookmarks')}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Bookmark className="w-6 h-6" />}
            title={t('noBookmarksYet')}
            description={t('noBookmarksHint')}
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
