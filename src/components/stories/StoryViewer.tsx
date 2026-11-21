import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BadgeCheck, ChevronLeft, ChevronRight, Eye, Heart, Loader2, Send, Trash2, X } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { StoryGroup, StoryViewerEntry } from '../../types';
import { messagingService, storiesService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

interface StoryViewerProps {
  storyGroups: StoryGroup[];
  initialGroupIndex: number;
  /** Story to start on inside the first group (e.g. the first one you haven't seen). Defaults to 0. */
  initialStoryIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  onStoryDeleted?: (storyId: string) => void;
  /** Called after a story view was recorded so the stories bar can flip the ring to "seen". */
  onStoryViewed?: (storyId: string) => void;
}

/** How long one photo stays on screen. */
const STORY_DURATION_MS = 6000;
/** Press-and-hold longer than this pauses the story instead of counting as a tap. */
const HOLD_DELAY_MS = 180;
const TAP_MOVE_TOLERANCE_PX = 10;
const SWIPE_DOWN_CLOSE_PX = 110;
const SWIPE_SIDE_PX = 70;
/** The first 35% of the card (on the reading-start side) goes back, everything else goes forward. */
const BACK_ZONE_RATIO = 0.35;
const QUICK_REACTIONS = ['❤️', '🔥', '😂', '😮', '😢', '👏'] as const;

const FOCUSABLE =
  'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])';

const formatAge = (iso: string, language: string, nowLabel: string): string => {
  const minutes = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return nowLabel;
  try {
    const rtf = new Intl.RelativeTimeFormat(language, { style: 'narrow', numeric: 'always' });
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return rtf.format(-hours, 'hour');
    return rtf.format(-Math.floor(hours / 24), 'day');
  } catch {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
};

export const StoryViewer: React.FC<StoryViewerProps> = ({
  storyGroups,
  initialGroupIndex,
  initialStoryIndex = 0,
  isOpen,
  onClose,
  onStoryDeleted,
  onStoryViewed,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { isRTL, language, t } = useLanguage();
  const reduceMotion = useReducedMotion();

  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [imageReady, setImageReady] = useState(false);
  const [holding, setHolding] = useState(false);
  const [composerActive, setComposerActive] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [heartBurst, setHeartBurst] = useState(0);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<StoryViewerEntry[]>([]);
  const [viewersState, setViewersState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [pageHidden, setPageHidden] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const progressRef = useRef(0);
  const viewedRef = useRef<Set<string>>(new Set());
  const gesture = useRef({
    active: false,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    moved: false,
    wasHolding: false,
    closedComposer: false,
    holdTimer: 0 as unknown as ReturnType<typeof setTimeout>,
  });

  // Stories deleted during this session disappear immediately, without waiting for the parent to refetch.
  const groups = useMemo(
    () =>
      storyGroups
        .map((group) => ({ ...group, stories: group.stories.filter((story) => !deletedIds.has(story.id)) }))
        .filter((group) => group.stories.length > 0),
    [storyGroups, deletedIds]
  );

  const currentGroup = groups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];
  const isAuthor = Boolean(user && currentStory && user.id === currentStory.author.id);
  const sheetOpen = confirmDelete || viewersOpen;
  const paused = holding || composerActive || sheetOpen || pageHidden || !imageReady;

  // --- navigation -----------------------------------------------------------------------------
  const goNext = useCallback(() => {
    if (!currentGroup) return;
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex((index) => index + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((index) => index + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  }, [currentGroup, storyIndex, groupIndex, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((index) => index - 1);
    } else if (groupIndex > 0) {
      setGroupIndex((index) => index - 1);
      setStoryIndex(groups[groupIndex - 1].stories.length - 1);
    } else {
      // First story of the first group: restart it instead of doing nothing.
      progressRef.current = 0;
      if (barRef.current) barRef.current.style.transform = 'scaleX(0)';
    }
  }, [storyIndex, groupIndex, groups]);

  const goNextGroup = useCallback(() => {
    if (groupIndex < groups.length - 1) {
      setGroupIndex((index) => index + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  }, [groupIndex, groups.length, onClose]);

  const goPrevGroup = useCallback(() => {
    if (groupIndex > 0) {
      setGroupIndex((index) => index - 1);
      setStoryIndex(0);
    }
  }, [groupIndex]);

  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // --- lifecycle --------------------------------------------------------------------------------
  // Reset when opened (and remember where focus was so it can be restored on close).
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    setGroupIndex(initialGroupIndex);
    setStoryIndex(initialStoryIndex);
    setDeletedIds(new Set());
    setConfirmDelete(false);
    setViewersOpen(false);
    setComposerActive(false);
    setReply('');
    setDragY(0);
    viewedRef.current = new Set();
    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen, initialGroupIndex, initialStoryIndex]);

  // Nothing left to show (everything was deleted, or the list changed under us): close.
  useEffect(() => {
    if (isOpen && !currentStory) onCloseRef.current();
  }, [isOpen, currentStory]);

  // New story: restart the progress bar and wait for the image.
  const currentStoryId = currentStory?.id;
  useEffect(() => {
    progressRef.current = 0;
    if (barRef.current) barRef.current.style.transform = 'scaleX(0)';
    const img = imgRef.current;
    setImageReady(Boolean(img && img.complete && img.naturalWidth > 0));
    setReply('');
    setViewersOpen(false);
    setConfirmDelete(false);
  }, [currentStoryId]);

  // Smooth progress driven by animation frames; it freezes whenever something should pause the story.
  useEffect(() => {
    if (!isOpen || !currentStoryId || paused) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      progressRef.current += (now - last) / STORY_DURATION_MS;
      last = now;
      if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(1, progressRef.current)})`;
      if (progressRef.current >= 1) {
        goNextRef.current();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isOpen, currentStoryId, paused]);

  // Pause while the tab is in the background.
  useEffect(() => {
    if (!isOpen) return;
    const onVisibility = () => setPageHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isOpen]);

  // Record the view once per story (never for your own stories) and tell the bar.
  useEffect(() => {
    if (!isOpen || !currentStory || !user) return;
    if (currentStory.author.id === user.id || currentStory.isViewed) return;
    if (viewedRef.current.has(currentStory.id)) return;
    viewedRef.current.add(currentStory.id);
    const storyId = currentStory.id;
    storiesService
      .viewStory(storyId)
      .then(() => onStoryViewed?.(storyId))
      .catch(() => {
        /* Not retried: a failed receipt must never break playback or hammer the rate-limited endpoint. */
      });
  }, [isOpen, currentStory, user, onStoryViewed]);

  // Warm the browser cache with the next photo so the jump feels instant.
  useEffect(() => {
    if (!isOpen || !currentGroup) return;
    const nextStory =
      currentGroup.stories[storyIndex + 1] ?? groups[groupIndex + 1]?.stories[0];
    if (nextStory) {
      const preload = new Image();
      preload.src = nextStory.mediaUrl;
    }
  }, [isOpen, currentGroup, groups, groupIndex, storyIndex]);

  // Keyboard: arrows follow the reading direction, Escape closes the top-most layer first.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

      if (event.key === 'Escape') {
        if (confirmDelete) setConfirmDelete(false);
        else if (viewersOpen) setViewersOpen(false);
        else if (composerActive && typing) (target as HTMLElement).blur();
        else onCloseRef.current();
        return;
      }

      if (event.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      if (typing || sheetOpen) return;
      const forwardKey = isRTL ? 'ArrowLeft' : 'ArrowRight';
      const backKey = isRTL ? 'ArrowRight' : 'ArrowLeft';
      if (event.key === forwardKey) goNext();
      if (event.key === backKey) goPrev();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isRTL, goNext, goPrev, confirmDelete, viewersOpen, composerActive, sheetOpen]);

  // --- gestures (tap = navigate, hold = pause, swipe down = close, swipe sideways = next/previous person) ---
  const resetGesture = () => {
    const g = gesture.current;
    clearTimeout(g.holdTimer);
    g.active = false;
    g.moved = false;
    setHolding(false);
    setDragging(false);
    setDragY(0);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const g = gesture.current;
    g.active = true;
    g.startX = event.clientX;
    g.startY = event.clientY;
    g.dx = 0;
    g.dy = 0;
    g.moved = false;
    g.wasHolding = false;
    // A tap that only dismisses the keyboard/reactions must not also skip the story.
    g.closedComposer = composerActive;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    clearTimeout(g.holdTimer);
    g.holdTimer = setTimeout(() => {
      g.wasHolding = true;
      setHolding(true);
    }, HOLD_DELAY_MS);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g.active) return;
    g.dx = event.clientX - g.startX;
    g.dy = event.clientY - g.startY;
    if (!g.moved && Math.hypot(g.dx, g.dy) > TAP_MOVE_TOLERANCE_PX) {
      g.moved = true;
      clearTimeout(g.holdTimer);
    }
    if (g.moved && g.dy > 0 && Math.abs(g.dy) > Math.abs(g.dx)) {
      setDragging(true);
      setHolding(true);
      setDragY(g.dy);
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g.active) return;
    const { dx, dy, moved, wasHolding, closedComposer } = g;
    const rect = event.currentTarget.getBoundingClientRect();
    resetGesture();

    if (dy > SWIPE_DOWN_CLOSE_PX && Math.abs(dy) > Math.abs(dx)) {
      onClose();
      return;
    }
    if (Math.abs(dx) > SWIPE_SIDE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const forward = isRTL ? dx > 0 : dx < 0;
      if (forward) goNextGroup();
      else goPrevGroup();
      return;
    }
    if (moved || wasHolding || closedComposer) return;

    const ratio = (event.clientX - rect.left) / rect.width;
    const inStartZone = isRTL ? ratio > 1 - BACK_ZONE_RATIO : ratio < BACK_ZONE_RATIO;
    if (inStartZone) goPrev();
    else goNext();
  };

  // --- actions ------------------------------------------------------------------------------------
  const sendToAuthor = async (kind: 'reply' | 'reaction', text: string): Promise<boolean> => {
    if (!currentStory || sending) return false;
    setSending(true);
    try {
      const conversation = await messagingService.getOrCreateConversation(currentStory.author.id);
      const prefix = kind === 'reply' ? t('storyReplyPrefix') : t('storyReactionPrefix');
      await messagingService.sendMessage(conversation.id, `${prefix}: ${text}`);
      return true;
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : t('toastStoryReplyFailed'), 'error');
      return false;
    } finally {
      setSending(false);
    }
  };

  const handleSendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = reply.trim();
    if (!text) return;
    if (await sendToAuthor('reply', text)) {
      setReply('');
      setComposerActive(false);
      (document.activeElement as HTMLElement | null)?.blur?.();
      showToast(t('toastStoryReplySent'));
    }
  };

  const handleReaction = async (emoji: string) => {
    if (!currentStory) return;
    const storyId = currentStory.id;
    if (likedIds.has(storyId)) return;
    // Optimistic: the heart reacts instantly and is rolled back if the message can't be delivered.
    setLikedIds((previous) => new Set(previous).add(storyId));
    setHeartBurst((value) => value + 1);
    const ok = await sendToAuthor('reaction', emoji);
    if (!ok) {
      setLikedIds((previous) => {
        const next = new Set(previous);
        next.delete(storyId);
        return next;
      });
    }
  };

  const openViewers = async () => {
    if (!currentStory) return;
    setViewersOpen(true);
    setViewersState('loading');
    try {
      setViewers(await storiesService.getStoryViewers(currentStory.id));
      setViewersState('idle');
    } catch {
      setViewers([]);
      setViewersState('error');
    }
  };

  const handleDelete = async () => {
    if (!currentStory || !currentGroup || deleting) return;
    const storyId = currentStory.id;
    const onlyStoryInGroup = currentGroup.stories.length === 1;
    const lastInGroup = storyIndex >= currentGroup.stories.length - 1;
    setDeleting(true);
    try {
      await storiesService.deleteStory(storyId);
      showToast(t('toastStoryDeleted'));
      setConfirmDelete(false);
      setDeletedIds((previous) => new Set(previous).add(storyId));
      if (onlyStoryInGroup) {
        setStoryIndex(0);
      } else if (lastInGroup) {
        setGroupIndex((index) => index + 1);
        setStoryIndex(0);
      }
      onStoryDeleted?.(storyId);
    } catch {
      showToast(t('toastStoryDeleteFailed'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen || !currentGroup || !currentStory) return null;

  const hasPrev = groupIndex > 0 || storyIndex > 0;
  const hasNext = groupIndex < groups.length - 1 || storyIndex < currentGroup.stories.length - 1;
  const liked = likedIds.has(currentStory.id);
  const chromeHidden = holding && !sheetOpen;
  const sheetMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('storyViewer')}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex select-none items-center justify-center bg-black outline-none"
      style={{ backgroundColor: `rgba(0,0,0,${Math.max(0.35, 1 - dragY / 500)})` }}
    >
      {/* Ambient glow from the current photo (desktop only; mobile shows the card edge-to-edge). */}
      <img
        src={currentStory.mediaUrl}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden h-full w-full scale-125 object-cover opacity-30 blur-3xl sm:block"
      />

      {/* Card */}
      <div
        className="relative h-full w-full overflow-hidden bg-black sm:h-[min(94dvh,880px)] sm:w-auto sm:aspect-[9/16] sm:rounded-2xl sm:shadow-2xl sm:ring-1 sm:ring-white/10"
        style={{
          transform: dragY ? `translateY(${dragY}px) scale(${Math.max(0.85, 1 - dragY / 1400)})` : undefined,
          transition: dragging ? 'none' : 'transform 200ms ease-out',
        }}
      >
        {/* Photo: blurred fill + contained foreground so non-9:16 pictures are never cropped */}
        <div className="absolute inset-0 bg-black">
          <img
            src={currentStory.mediaUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
          />
          <img
            key={currentStory.id}
            ref={imgRef}
            src={currentStory.mediaUrl}
            alt={currentStory.caption || t('storyViewer')}
            draggable={false}
            onLoad={() => setImageReady(true)}
            onError={() => setImageReady(true)}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 ${
              imageReady ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {!imageReady && (
            <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <Loader2 className="h-8 w-8 animate-spin text-white/70" />
            </div>
          )}
        </div>

        {/* Gesture surface: tap, hold, swipe */}
        <div
          className="absolute inset-0 z-10 touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={resetGesture}
          onContextMenu={(event) => event.preventDefault()}
        />

        {/* Floating heart when you react */}
        <AnimatePresence>
          {heartBurst > 0 && liked && (
            <motion.div
              key={heartBurst}
              initial={{ scale: 0.4, opacity: 0.95 }}
              animate={{ scale: reduceMotion ? 1 : 1.7, opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.2 : 0.8, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
              aria-hidden="true"
            >
              <Heart className="h-24 w-24 fill-rose-500 text-rose-500 drop-shadow-xl" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top chrome: progress + author */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/70 via-black/30 to-transparent px-3 pb-8 transition-opacity duration-150 ${
            chromeHidden ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
        >
          <div className="flex gap-1" aria-hidden="true">
            {currentGroup.stories.map((story, index) => (
              <div key={story.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                {index < storyIndex ? (
                  <div className="h-full w-full bg-white" />
                ) : index === storyIndex ? (
                  <div
                    ref={barRef}
                    className={`h-full w-full bg-white ${isRTL ? 'origin-right' : 'origin-left'}`}
                    style={{ transform: 'scaleX(0)' }}
                  />
                ) : null}
              </div>
            ))}
          </div>

          <div className="pointer-events-auto mt-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar src={currentStory.author.avatar} alt={currentStory.author.name} size="md" />
              <div className="flex min-w-0 items-center gap-1.5 text-start">
                <span className="truncate text-sm font-semibold text-white drop-shadow">
                  <bdi>{currentStory.author.name}</bdi>
                </span>
                {currentStory.author.verified && (
                  <BadgeCheck className="h-4 w-4 shrink-0 fill-sky-500 text-white" aria-hidden="true" />
                )}
                <span className="shrink-0 text-xs text-white/75">
                  {formatAge(currentStory.createdAt, language, t('storyTimeNow'))}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {isAuthor && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15"
                  title={t('deleteStory')}
                  aria-label={t('deleteStory')}
                >
                  <Trash2 className="h-[18px] w-[18px]" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
                aria-label={t('closeStoryViewer')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom chrome: caption + reply / seen-by */}
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-4 pt-16 transition-opacity duration-150 ${
            chromeHidden ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
        >
          {currentStory.caption && (
            <p
              dir="auto"
              className="pointer-events-auto mb-3 line-clamp-4 text-center text-sm font-medium leading-relaxed text-white drop-shadow-md [overflow-wrap:anywhere]"
            >
              {currentStory.caption}
            </p>
          )}

          {isAuthor ? (
            <div className="pointer-events-auto flex justify-center">
              <button
                type="button"
                onClick={() => void openViewers()}
                className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/25"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                <span>
                  {t('storySeenBy')} {currentStory.viewsCount}
                </span>
              </button>
            </div>
          ) : (
            <div
              className="pointer-events-auto"
              onFocus={() => setComposerActive(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setComposerActive(false);
              }}
            >
              {composerActive && (
                <div className="mb-3 flex items-center justify-between gap-1 px-1" role="group" aria-label={t('storyLike')}>
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      // keep the text field focused so the reaction row doesn't vanish before the click lands
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={() => void handleReaction(emoji)}
                      disabled={sending || liked}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-2xl transition-transform hover:scale-125 active:scale-95 disabled:opacity-50"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={(event) => void handleSendReply(event)} className="flex items-center gap-2">
                <input
                  type="text"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder={t('storyReplyPlaceholder')}
                  maxLength={500}
                  dir="auto"
                  aria-label={t('storyReplyPlaceholder')}
                  className="h-11 min-w-0 flex-1 rounded-full border border-white/50 bg-black/20 px-4 text-sm text-white outline-none backdrop-blur-sm placeholder:text-white/70 focus:border-white"
                />
                {reply.trim() ? (
                  <button
                    type="submit"
                    disabled={sending}
                    onPointerDown={(event) => event.preventDefault()}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 disabled:opacity-50"
                    aria-label={t('storySend')}
                  >
                    {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 rtl:-scale-x-100" />}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={sending || liked}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => void handleReaction('❤️')}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-transform hover:bg-white/15 active:scale-90 disabled:opacity-100"
                    aria-label={t('storyLike')}
                    aria-pressed={liked}
                  >
                    <Heart className={`h-6 w-6 ${liked ? 'fill-rose-500 text-rose-500' : ''}`} />
                  </button>
                )}
              </form>
            </div>
          )}
        </div>

        {/* Seen-by sheet (author only) */}
        <AnimatePresence>
          {viewersOpen && (
            <motion.div className="absolute inset-0 z-40 flex flex-col justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setViewersOpen(false)} aria-label={t('closeStoryViewer')} tabIndex={-1} />
              <motion.div
                {...sheetMotion}
                transition={{ type: 'tween', duration: 0.2 }}
                role="dialog"
                aria-label={t('storySeenBy')}
                className="relative flex max-h-[65%] flex-col rounded-t-3xl bg-surface-elevated text-fg shadow-2xl"
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
              >
                <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
                <div className="flex items-center justify-between px-5 py-3">
                  <h2 className="flex items-center gap-2 text-sm font-bold">
                    <Eye className="h-4 w-4 text-primary-text" aria-hidden="true" />
                    {t('storySeenBy')} {viewersState === 'idle' ? viewers.length || currentStory.viewsCount : currentStory.viewsCount}
                  </h2>
                  <button type="button" onClick={() => setViewersOpen(false)} className="rounded-full p-1.5 text-fg-muted hover:bg-surface-hover" aria-label={t('closeStoryViewer')}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="min-h-[120px] flex-1 overflow-y-auto px-3 pb-2">
                  {viewersState === 'loading' && (
                    <div className="flex h-28 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-fg-muted" /></div>
                  )}
                  {viewersState === 'error' && (
                    <p className="py-8 text-center text-xs text-danger-text">{t('storyViewersFailed')}</p>
                  )}
                  {viewersState === 'idle' && viewers.length === 0 && (
                    <p className="py-8 text-center text-xs text-fg-muted">{t('storyNoViews')}</p>
                  )}
                  {viewersState === 'idle' && viewers.length > 0 && (
                    <ul className="space-y-1">
                      {viewers.map((entry) => (
                        <li key={entry.user.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                          <Avatar src={entry.user.avatar} alt={entry.user.name} size="md" />
                          <div className="min-w-0 flex-1 text-start">
                            <p className="flex items-center gap-1 truncate text-sm font-semibold">
                              <bdi className="truncate">{entry.user.name}</bdi>
                              {entry.user.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-sky-500 text-white" aria-hidden="true" />}
                            </p>
                            {entry.user.username && <p className="truncate text-xs text-fg-muted" dir="ltr">@{entry.user.username}</p>}
                          </div>
                          <span className="shrink-0 text-xs text-fg-subtle">{formatAge(entry.viewedAt, language, t('storyTimeNow'))}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete confirmation */}
        <AnimatePresence>
          {confirmDelete && (
            <motion.div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div role="alertdialog" aria-label={t('storyDeleteConfirmTitle')} className="w-full max-w-xs rounded-2xl bg-surface-elevated p-5 text-center text-fg shadow-2xl">
                <h2 className="text-base font-bold">{t('storyDeleteConfirmTitle')}</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{t('storyDeleteConfirmBody')}</p>
                <div className="mt-5 flex gap-2">
                  <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting} className="h-10 flex-1 rounded-xl border border-border text-sm font-semibold hover:bg-surface-hover disabled:opacity-50">
                    {t('cancel')}
                  </button>
                  <button type="button" onClick={() => void handleDelete()} disabled={deleting} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-danger text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                    {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('deleteStory')}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop arrows */}
      {hasPrev && (
        <button
          type="button"
          onClick={goPrev}
          className="absolute start-6 hidden h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/25 sm:flex"
          aria-label={t('previousStory')}
        >
          <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          onClick={goNext}
          className="absolute end-6 hidden h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/25 sm:flex"
          aria-label={t('nextStory')}
        >
          <ChevronRight className="h-6 w-6 rtl:rotate-180" />
        </button>
      )}
    </div>
  );
};
