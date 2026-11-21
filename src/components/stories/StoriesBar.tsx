import React, { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { StoryGroup } from '../../types';
import { storiesService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { StoryViewer } from './StoryViewer';
import { CreateStoryModal } from './CreateStoryModal';

const FALLBACK_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

const RING_UNSEEN = 'bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-blue-500';
const RING_SEEN = 'bg-border';

/** Your own stories first, then people you haven't caught up with, then everyone else (original order kept). */
const orderGroups = (groups: StoryGroup[], currentUserId?: string): StoryGroup[] => {
  const rank = (group: StoryGroup) => (group.user.id === currentUserId ? 0 : group.hasUnviewed ? 1 : 2);
  return groups
    .map((group, index) => ({ group, index }))
    .sort((a, b) => rank(a.group) - rank(b.group) || a.index - b.index)
    .map(({ group }) => group);
};

const withViewedStory = (groups: StoryGroup[], storyId: string): StoryGroup[] =>
  groups.map((group) => {
    if (!group.stories.some((story) => story.id === storyId)) return group;
    const stories = group.stories.map((story) => (story.id === storyId ? { ...story, isViewed: true } : story));
    return { ...group, stories, hasUnviewed: stories.some((story) => !story.isViewed) };
  });

export const StoriesBar: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  // Frozen at the moment the viewer opens so live "seen" updates never move the playhead.
  const [selected, setSelected] = useState<{ group: number; story: number } | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadStoryGroups = useCallback(async () => {
    try {
      const groups = await storiesService.getStoryGroups();
      setStoryGroups(orderGroups(groups, user?.id));
    } catch {
      // The bar is optional chrome; the feed must keep working if stories fail to load.
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadStoryGroups();
  }, [loadStoryGroups]);

  const openViewer = (index: number) => {
    const firstUnseen = storyGroups[index]?.stories.findIndex((story) => !story.isViewed) ?? -1;
    setSelected({ group: index, story: firstUnseen > 0 ? firstUnseen : 0 });
  };

  const handleStoryViewed = useCallback((storyId: string) => {
    setStoryGroups((groups) => withViewedStory(groups, storyId));
  }, []);

  const ownGroupIndex = storyGroups.findIndex((group) => group.user.id === user?.id);
  const userHasStory = ownGroupIndex !== -1;

  return (
    <>
      <div className="no-scrollbar relative select-none overflow-x-auto border-b border-border bg-surface/50 px-4 py-3">
        <div className="flex min-w-max items-start gap-4">
          {/* Your story */}
          <div className="group flex w-[72px] flex-col items-center gap-1.5">
            <div className="relative">
              <button
                type="button"
                onClick={() => (userHasStory ? openViewer(ownGroupIndex) : setIsCreateModalOpen(true))}
                className={`block rounded-full p-[2.5px] transition-transform active:scale-95 group-hover:scale-105 ${
                  userHasStory ? RING_UNSEEN : 'bg-transparent'
                }`}
                aria-label={userHasStory ? t('yourStory') : t('addStory')}
              >
                <img
                  src={user?.avatar || FALLBACK_AVATAR}
                  alt=""
                  className="h-16 w-16 rounded-full border-[3px] border-surface object-cover"
                />
              </button>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="absolute -bottom-0.5 end-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-primary text-primary-fg shadow-md transition-transform hover:scale-110"
                title={t('addStory')}
                aria-label={t('addStory')}
              >
                <Plus className="h-3.5 w-3.5 stroke-[3]" />
              </button>
            </div>
            <span className="w-full truncate text-center text-[11px] font-medium text-fg-muted">{t('yourStory')}</span>
          </div>

          {/* Everyone else */}
          {loading
            ? [1, 2, 3, 4].map((i) => (
                <div key={i} className="flex w-[72px] flex-col items-center gap-1.5" aria-hidden="true">
                  <div className="h-[70px] w-[70px] animate-pulse rounded-full bg-surface-hover" />
                  <div className="h-2 w-10 animate-pulse rounded bg-surface-hover" />
                </div>
              ))
            : storyGroups.map((group, index) => {
                if (group.user.id === user?.id) return null;
                return (
                  <button
                    type="button"
                    key={group.user.id}
                    onClick={() => openViewer(index)}
                    className="group flex w-[72px] flex-col items-center gap-1.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={group.user.name}
                  >
                    <span
                      className={`block rounded-full p-[2.5px] transition-transform active:scale-95 group-hover:scale-105 ${
                        group.hasUnviewed ? `${RING_UNSEEN} shadow-[0_0_12px_rgba(139,92,246,0.35)]` : RING_SEEN
                      }`}
                    >
                      <img
                        src={group.user.avatar || FALLBACK_AVATAR}
                        alt=""
                        loading="lazy"
                        className="h-16 w-16 rounded-full border-[3px] border-surface object-cover"
                      />
                    </span>
                    <span
                      className={`w-full truncate text-center text-[11px] ${
                        group.hasUnviewed ? 'font-semibold text-fg' : 'font-medium text-fg-muted'
                      }`}
                    >
                      <bdi>{group.user.name.split(' ')[0]}</bdi>
                    </span>
                  </button>
                );
              })}
        </div>
      </div>

      {selected !== null && (
        <StoryViewer
          storyGroups={storyGroups}
          initialGroupIndex={selected.group}
          initialStoryIndex={selected.story}
          isOpen
          onClose={() => setSelected(null)}
          onStoryViewed={handleStoryViewed}
          onStoryDeleted={() => void loadStoryGroups()}
        />
      )}

      <CreateStoryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onStoryCreated={() => void loadStoryGroups()}
      />
    </>
  );
};
