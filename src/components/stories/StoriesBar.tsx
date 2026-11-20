import React, { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { StoryGroup } from '../../types';
import { storiesService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { StoryViewer } from './StoryViewer';
import { CreateStoryModal } from './CreateStoryModal';

export const StoriesBar: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadStoryGroups = useCallback(async () => {
    try {
      const groups = await storiesService.getStoryGroups();
      setStoryGroups(groups);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStoryGroups();
  }, [loadStoryGroups]);

  const handleOpenViewer = (index: number) => {
    setSelectedGroupIndex(index);
  };

  const handleStoryCreated = () => {
    loadStoryGroups();
  };

  const userHasStory = storyGroups.some((g) => g.user.id === user?.id);
  const userStoryGroupIndex = storyGroups.findIndex((g) => g.user.id === user?.id);

  return (
    <>
      <div className="relative py-2.5 px-4 overflow-x-auto no-scrollbar border-b border-border bg-surface/50 select-none">
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-max">
          {/* Create / Your Story Item */}
          <div className="flex flex-col items-center gap-1.5 cursor-pointer group">
            <div className="relative">
              <button
                onClick={() => {
                  if (userHasStory && userStoryGroupIndex !== -1) {
                    handleOpenViewer(userStoryGroupIndex);
                  } else {
                    setIsCreateModalOpen(true);
                  }
                }}
                className={`relative p-0.5 rounded-full transition-transform group-hover:scale-105 ${
                  userHasStory
                    ? 'bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-blue-500 p-[2.5px]'
                    : ''
                }`}
              >
                <img
                  src={
                    user?.avatar ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
                  }
                  alt={user?.name || 'Your Story'}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-surface"
                />
              </button>

              {/* Plus badge */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCreateModalOpen(true);
                }}
                className="absolute bottom-0 end-0 p-1 rounded-full bg-primary hover:bg-primary-hover text-primary-fg border-2 border-surface shadow-md transition-transform hover:scale-110 min-w-[24px] min-h-[24px] flex items-center justify-center"
                title={t('addStory')}
                aria-label={t('addStory')}
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </div>
            <span className="text-[11px] font-medium text-fg-muted max-w-[68px] truncate">
              {t('yourStory')}
            </span>
          </div>

          {/* Other Users' Stories */}
          {loading ? (
            // Skeleton circles
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-surface-hover animate-pulse border-2 border-border" />
                <div className="w-10 h-2 bg-surface-hover rounded animate-pulse" />
              </div>
            ))
          ) : (
            storyGroups
              .filter((g) => g.user.id !== user?.id)
              .map((group) => {
                const actualIndex = storyGroups.findIndex((g) => g.user.id === group.user.id);
                return (
                  <button
                    key={group.user.id}
                    onClick={() => handleOpenViewer(actualIndex)}
                    className="flex flex-col items-center gap-1.5 cursor-pointer group focus:outline-none"
                  >
                    <div
                      className={`p-[2.5px] rounded-full transition-transform group-hover:scale-105 ${
                        group.hasUnviewed
                          ? 'bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-blue-500 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                          : 'border-2 border-border p-[1.5px]'
                      }`}
                    >
                      <img
                        src={group.user.avatar}
                        alt={group.user.name}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-surface"
                      />
                    </div>
                    <span className="text-[11px] font-medium text-fg-muted max-w-[68px] truncate">
                      <bdi>{group.user.name.split(' ')[0]}</bdi>
                    </span>
                  </button>
                );
              })
          )}
        </div>
      </div>

      {/* Story Viewer Modal */}
      {selectedGroupIndex !== null && (
        <StoryViewer
          storyGroups={storyGroups}
          initialGroupIndex={selectedGroupIndex}
          isOpen={selectedGroupIndex !== null}
          onClose={() => setSelectedGroupIndex(null)}
          onStoryDeleted={() => loadStoryGroups()}
        />
      )}

      {/* Create Story Modal */}
      <CreateStoryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onStoryCreated={handleStoryCreated}
      />
    </>
  );
};
