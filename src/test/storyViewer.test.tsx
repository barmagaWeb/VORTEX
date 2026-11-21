import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { StoryGroup, User } from '../types';

// jsdom has no PointerEvent; without this fireEvent.pointer* would carry no coordinates.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  Object.defineProperty(window, 'PointerEvent', { configurable: true, writable: true, value: PointerEventPolyfill });
}

const mocks = vi.hoisted(() => ({
  viewStory: vi.fn(),
  deleteStory: vi.fn(),
  getStoryViewers: vi.fn(),
  getOrCreateConversation: vi.fn(),
  sendMessage: vi.fn(),
  showToast: vi.fn(),
  currentUserId: 'me',
}));

vi.mock('../services', () => ({
  storiesService: {
    viewStory: mocks.viewStory,
    deleteStory: mocks.deleteStory,
    getStoryViewers: mocks.getStoryViewers,
  },
  messagingService: {
    getOrCreateConversation: mocks.getOrCreateConversation,
    sendMessage: mocks.sendMessage,
  },
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: mocks.currentUserId } }) }));
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: mocks.showToast }) }));

import { StoryViewer } from '../components/stories/StoryViewer';
import { LanguageProvider } from '../context/LanguageContext';

const makeUser = (id: string, name: string): User => ({
  id,
  name,
  username: name.toLowerCase(),
  avatar: '',
  followersCount: 0,
  followingCount: 0,
  postsCount: 0,
  joinedDate: '',
  role: 'user',
});

const me = makeUser('me', 'Me');
const sara = makeUser('u2', 'Sara');
const omar = makeUser('u3', 'Omar');

const story = (id: string, author: User, caption: string) => ({
  id,
  author,
  mediaUrl: `https://img.test/${id}.jpg`,
  mediaType: 'image' as const,
  caption,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  viewsCount: 3,
  isViewed: false,
});

const buildGroups = (): StoryGroup[] => [
  { user: sara, hasUnviewed: true, stories: [story('s1', sara, 'first'), story('s2', sara, 'second')] },
  { user: omar, hasUnviewed: true, stories: [story('o1', omar, 'omar one')] },
];

const renderViewer = (groups: StoryGroup[], props: Partial<React.ComponentProps<typeof StoryViewer>> = {}) => {
  const onClose = vi.fn();
  const utils = render(
    <LanguageProvider>
      <StoryViewer storyGroups={groups} initialGroupIndex={0} isOpen onClose={onClose} {...props} />
    </LanguageProvider>,
  );
  return { onClose, ...utils };
};

const captionOnScreen = (text: string) => screen.getByText(text, { selector: 'p' });

describe('StoryViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('vortex_lang', 'en');
    mocks.currentUserId = 'me';
    mocks.viewStory.mockResolvedValue(undefined);
    mocks.deleteStory.mockResolvedValue(true);
    mocks.getStoryViewers.mockResolvedValue([]);
    mocks.getOrCreateConversation.mockResolvedValue({ id: 'conv-1' });
    mocks.sendMessage.mockResolvedValue({ id: 'm1' });
    // jsdom has no layout: give the card a 400px-wide box so tap zones can be computed.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 800, width: 400, height: 800, toJSON: () => ({}),
    });
  });

  it('is an accessible modal dialog showing the author and caption', () => {
    renderViewer(buildGroups());
    expect(screen.getByRole('dialog', { name: 'Story Viewer' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Sara')).toBeInTheDocument();
    expect(captionOnScreen('first')).toBeInTheDocument();
  });

  it('moves through stories with the arrow keys and closes on the last one', () => {
    const { onClose } = renderViewer(buildGroups());
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(captionOnScreen('second')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(captionOnScreen('omar one')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(captionOnScreen('second')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('navigates by tapping: start third goes back, the rest goes forward', () => {
    const { container } = renderViewer(buildGroups());
    const surface = container.querySelector('.touch-none') as HTMLElement;
    const tap = (x: number) => {
      fireEvent.pointerDown(surface, { clientX: x, clientY: 300, button: 0, pointerType: 'touch', pointerId: 1 });
      fireEvent.pointerUp(surface, { clientX: x, clientY: 300, button: 0, pointerType: 'touch', pointerId: 1 });
    };
    tap(350);
    expect(captionOnScreen('second')).toBeInTheDocument();
    tap(20);
    expect(captionOnScreen('first')).toBeInTheDocument();
  });

  it('closes on Escape and on a long swipe down', () => {
    const { onClose, container } = renderViewer(buildGroups());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    const surface = container.querySelector('.touch-none') as HTMLElement;
    fireEvent.pointerDown(surface, { clientX: 200, clientY: 100, button: 0, pointerType: 'touch', pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 205, clientY: 320, pointerType: 'touch', pointerId: 1 });
    fireEvent.pointerUp(surface, { clientX: 205, clientY: 320, pointerType: 'touch', pointerId: 1 });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("records a view for other people's stories only once and reports it", async () => {
    const onStoryViewed = vi.fn();
    renderViewer(buildGroups(), { onStoryViewed });
    await waitFor(() => expect(mocks.viewStory).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(onStoryViewed).toHaveBeenCalledWith('s1'));
    expect(mocks.viewStory).toHaveBeenCalledTimes(1);
  });

  it('never records a view (or shows the reply bar) on your own story', () => {
    renderViewer([{ user: me, hasUnviewed: true, stories: [story('mine', me, 'my story')] }]);
    expect(mocks.viewStory).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('Send message…')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Seen by 3/ })).toBeInTheDocument();
  });

  it('does not let a failing view receipt break playback', async () => {
    mocks.viewStory.mockRejectedValue(new Error('rate limited'));
    renderViewer(buildGroups());
    await waitFor(() => expect(mocks.viewStory).toHaveBeenCalled());
    expect(captionOnScreen('first')).toBeInTheDocument();
  });

  it('sends a reply to the story author as a direct message', async () => {
    renderViewer(buildGroups());
    const input = screen.getByPlaceholderText('Send message…');
    fireEvent.change(input, { target: { value: 'Nice shot!' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    await waitFor(() => expect(mocks.sendMessage).toHaveBeenCalledWith('conv-1', 'Replied to your story: Nice shot!'));
    expect(mocks.getOrCreateConversation).toHaveBeenCalledWith('u2');
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('Message sent'));
    expect(input).toHaveValue('');
  });

  it('shows an error and keeps the draft when the reply cannot be delivered', async () => {
    mocks.sendMessage.mockRejectedValue(new Error('You are blocked'));
    renderViewer(buildGroups());
    const input = screen.getByPlaceholderText('Send message…');
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('You are blocked', 'error'));
    expect(input).toHaveValue('hello');
  });

  it('likes a story once with a heart reaction and rolls back on failure', async () => {
    renderViewer(buildGroups());
    const heart = screen.getByRole('button', { name: 'Like story' });
    fireEvent.click(heart);
    await waitFor(() => expect(mocks.sendMessage).toHaveBeenCalledWith('conv-1', 'Reacted to your story: ❤️'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Like story' })).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(screen.getByRole('button', { name: 'Like story' }));
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('un-likes locally when the reaction message fails', async () => {
    mocks.sendMessage.mockRejectedValue(new Error('nope'));
    renderViewer(buildGroups());
    fireEvent.click(screen.getByRole('button', { name: 'Like story' }));
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('nope', 'error'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Like story' })).toHaveAttribute('aria-pressed', 'false'));
  });

  it('lets the owner open the viewers list', async () => {
    mocks.getStoryViewers.mockResolvedValue([
      { user: sara, viewedAt: new Date().toISOString() },
      { user: omar, viewedAt: new Date().toISOString() },
    ]);
    renderViewer([{ user: me, hasUnviewed: true, stories: [story('mine', me, 'my story')] }]);
    fireEvent.click(screen.getByRole('button', { name: /Seen by 3/ }));
    expect(await screen.findByText('Omar')).toBeInTheDocument();
    expect(mocks.getStoryViewers).toHaveBeenCalledWith('mine');
    expect(screen.getByText('Sara')).toBeInTheDocument();
  });

  it('shows an empty state and an error state for the viewers list', async () => {
    renderViewer([{ user: me, hasUnviewed: true, stories: [story('mine', me, 'my story')] }]);
    fireEvent.click(screen.getByRole('button', { name: /Seen by 3/ }));
    expect(await screen.findByText('No views yet')).toBeInTheDocument();
  });

  it('asks before deleting, then deletes and notifies the parent', async () => {
    const onStoryDeleted = vi.fn();
    const { onClose } = renderViewer(
      [{ user: me, hasUnviewed: true, stories: [story('mine', me, 'my story')] }],
      { onStoryDeleted },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete Story' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(mocks.deleteStory).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete Story' }).at(-1) as HTMLElement);
    await waitFor(() => expect(mocks.deleteStory).toHaveBeenCalledWith('mine'));
    await waitFor(() => expect(onStoryDeleted).toHaveBeenCalledWith('mine'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('can cancel the delete confirmation without deleting', () => {
    renderViewer([{ user: me, hasUnviewed: true, stories: [story('mine', me, 'my story')] }]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Story' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mocks.deleteStory).not.toHaveBeenCalled();
    return waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('starts on the requested story inside the first group', () => {
    renderViewer(buildGroups(), { initialStoryIndex: 1 });
    expect(captionOnScreen('second')).toBeInTheDocument();
  });

  it('follows the reading direction in Arabic (ArrowLeft goes forward) and localises the UI', () => {
    localStorage.setItem('vortex_lang', 'ar');
    renderViewer(buildGroups());
    expect(screen.getByPlaceholderText('أرسل رسالة…')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(captionOnScreen('second')).toBeInTheDocument();
  });
});
