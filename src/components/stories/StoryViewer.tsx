import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Trash2 } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { StoryGroup } from '../../types';
import { storiesService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface StoryViewerProps {
  storyGroups: StoryGroup[];
  initialGroupIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onStoryDeleted?: (storyId: string) => void;
}

export const StoryViewer: React.FC<StoryViewerProps> = ({
  storyGroups,
  initialGroupIndex,
  isOpen,
  onClose,
  onStoryDeleted,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentGroup = storyGroups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];

  // Mark viewed whenever story changes
  useEffect(() => {
    if (currentStory && !currentStory.isViewed) {
      storiesService.viewStory(currentStory.id);
      currentStory.isViewed = true;
    }
  }, [currentStory]);

  const goToNextStory = useCallback(() => {
    if (!currentGroup) return;

    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex((prev) => prev + 1);
      setProgress(0);
    } else if (groupIndex < storyGroups.length - 1) {
      setGroupIndex((prev) => prev + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentGroup, storyIndex, groupIndex, storyGroups.length, onClose]);

  const goToPrevStory = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      const prevGroup = storyGroups[groupIndex - 1];
      setGroupIndex((prev) => prev - 1);
      setStoryIndex(prevGroup.stories.length - 1);
      setProgress(0);
    }
  }, [storyIndex, groupIndex, storyGroups]);

  // Story progress timer
  useEffect(() => {
    if (!isOpen || !currentStory || isPaused) return;

    const interval = 50; // update every 50ms
    const totalDuration = 5000;
    const increment = (interval / totalDuration) * 100;

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          goToNextStory();
          return 0;
        }
        return prev + increment;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, currentStory, isPaused, goToNextStory]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goToNextStory();
      if (e.key === 'ArrowLeft') goToPrevStory();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToNextStory, goToPrevStory, onClose]);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setGroupIndex(initialGroupIndex);
      setStoryIndex(0);
      setProgress(0);
    }
  }, [isOpen, initialGroupIndex]);

  if (!isOpen || !currentGroup || !currentStory) return null;

  const isAuthor = user?.id === currentStory.author.id;

  const handleDeleteStory = async () => {
    if (window.confirm('Delete this story?')) {
      try {
        await storiesService.deleteStory(currentStory.id);
        showToast('Story deleted');
        if (onStoryDeleted) onStoryDeleted(currentStory.id);
        if (currentGroup.stories.length <= 1) {
          onClose();
        } else {
          goToNextStory();
        }
      } catch {
        showToast('Failed to delete story', 'error');
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center select-none"
      onMouseDown={() => setIsPaused(true)}
      onMouseUp={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Central Story Container */}
      <div className="relative w-full max-w-sm sm:max-w-md h-[90vh] max-h-[800px] bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col justify-between">
        {/* Progress Bars Row */}
        <div className="absolute top-0 inset-x-0 z-30 p-3 pt-4 flex gap-1.5">
          {currentGroup.stories.map((story, idx) => {
            let widthPercent = 0;
            if (idx < storyIndex) widthPercent = 100;
            else if (idx === storyIndex) widthPercent = progress;

            return (
              <div
                key={story.id}
                className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm"
              >
                <div
                  className="h-full bg-white transition-all duration-75 ease-linear rounded-full"
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Top Header: Author + Close */}
        <div className="absolute top-7 inset-x-0 z-30 px-4 py-2 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-3">
            <Avatar
              src={currentStory.author.avatar}
              alt={currentStory.author.name}
              size="sm"
            />
            <div className="flex flex-col text-start">
              <span className="text-xs font-bold text-white leading-tight">
                {currentStory.author.name}
              </span>
              <span className="text-[10px] text-slate-300">
                {new Date(currentStory.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthor && (
              <>
                <div className="flex items-center gap-1 text-[11px] text-slate-300 bg-black/50 px-2 py-1 rounded-full">
                  <Eye className="w-3.5 h-3.5 text-violet-400" />
                  <span>{currentStory.viewsCount}</span>
                </div>
                <button
                  onClick={handleDeleteStory}
                  className="p-1.5 rounded-full bg-black/40 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-colors"
                  title="Delete Story"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-black/40 hover:bg-black/80 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image-only story media */}
        <div className="relative flex-1 w-full h-full flex items-center justify-center bg-black">
          <img
            src={currentStory.mediaUrl}
            alt={currentStory.caption || 'Story'}
            className="w-full h-full object-cover"
          />

          {/* Touch/Click Areas for Next/Prev */}
          <div
            className="absolute inset-y-0 start-0 w-1/3 cursor-pointer z-20"
            onClick={(e) => {
              e.stopPropagation();
              goToPrevStory();
            }}
          />
          <div
            className="absolute inset-y-0 end-0 w-1/3 cursor-pointer z-20"
            onClick={(e) => {
              e.stopPropagation();
              goToNextStory();
            }}
          />
        </div>

        {/* Bottom Caption Overlay */}
        {currentStory.caption && (
          <div className="absolute bottom-0 inset-x-0 z-30 p-5 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
            <p className="text-xs sm:text-sm text-white text-center font-medium leading-relaxed drop-shadow-md">
              {currentStory.caption}
            </p>
          </div>
        )}
      </div>

      {/* Outer Left / Right Arrows */}
      {groupIndex > 0 && (
        <button
          onClick={goToPrevStory}
          className="hidden sm:flex absolute start-6 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 transition-transform hover:scale-110"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {(groupIndex < storyGroups.length - 1 || storyIndex < currentGroup.stories.length - 1) && (
        <button
          onClick={goToNextStory}
          className="hidden sm:flex absolute end-6 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 transition-transform hover:scale-110"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};
