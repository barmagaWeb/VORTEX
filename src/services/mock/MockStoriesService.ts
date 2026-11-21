import { IStoriesService, CreateStoryDTO } from '../interfaces/IStoriesService';
import { Story, StoryGroup, StoryViewerEntry, User } from '../../types';
import { CURRENT_USER, MOCK_USERS } from '../../constants/mockData';
import { storage } from './storage';

const STORAGE_KEY_STORIES = 'vortex_stories_store';
const STORAGE_KEY_VIEWS = 'vortex_story_views_store';

const INITIAL_STORIES: Story[] = [
  {
    id: 'story_1',
    author: CURRENT_USER,
    mediaUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'Sunset vibes at the summit 🌄',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    expiresAt: new Date(Date.now() + 3600000 * 22).toISOString(),
    viewsCount: 142,
    isViewed: false,
  },
  {
    id: 'story_2',
    author: MOCK_USERS[2], // Sara Ahmed
    mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'Exploring modern 3D abstract structures in Blender 🔮✨',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    expiresAt: new Date(Date.now() + 3600000 * 20).toISOString(),
    viewsCount: 389,
    isViewed: false,
  },
  {
    id: 'story_3',
    author: MOCK_USERS[2], // Sara Ahmed (second story)
    mediaUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'Retro tech aesthetics work station 💻',
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    expiresAt: new Date(Date.now() + 3600000 * 23).toISOString(),
    viewsCount: 210,
    isViewed: false,
  },
  {
    id: 'story_4',
    author: MOCK_USERS[3] || {
      id: 'usr_mohamed',
      name: 'Mohamed Ali',
      username: 'mohamed_ali',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      followersCount: 19800,
      followingCount: 180,
      postsCount: 167,
      joinedDate: 'April 2024',
      verified: true,
      role: 'user',
    },
    mediaUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'Deep focus coding session 🚀 #DevLife',
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    expiresAt: new Date(Date.now() + 3600000 * 18).toISOString(),
    viewsCount: 95,
    isViewed: false,
  },
];

export class MockStoriesService implements IStoriesService {
  private getStoriesStore(): Story[] {
    return storage.get<Story[]>(STORAGE_KEY_STORIES, INITIAL_STORIES);
  }

  private saveStoriesStore(stories: Story[]): void {
    storage.set(STORAGE_KEY_STORIES, stories);
  }

  private getViewedIds(): string[] {
    return storage.get<string[]>(STORAGE_KEY_VIEWS, []);
  }

  private saveViewedIds(ids: string[]): void {
    storage.set(STORAGE_KEY_VIEWS, ids);
  }

  async getStoryGroups(): Promise<StoryGroup[]> {
    const stories = this.getStoriesStore();
    const viewedIds = new Set(this.getViewedIds());

    // Filter unexpired stories
    const now = Date.now();
    const activeStories = stories.filter((s) => new Date(s.expiresAt).getTime() > now);

    // Group by author id
    const groupMap = new Map<string, { user: User; stories: Story[] }>();

    for (const story of activeStories) {
      const isViewed = viewedIds.has(story.id);
      const enhancedStory = { ...story, isViewed };

      if (!groupMap.has(story.author.id)) {
        groupMap.set(story.author.id, {
          user: story.author,
          stories: [enhancedStory],
        });
      } else {
        groupMap.get(story.author.id)!.stories.push(enhancedStory);
      }
    }

    const groups: StoryGroup[] = [];
    for (const [, val] of groupMap.entries()) {
      const hasUnviewed = val.stories.some((s) => !s.isViewed);
      groups.push({
        user: val.user,
        stories: val.stories,
        hasUnviewed,
      });
    }

    // Sort: current user first if present, then users with unviewed stories
    return groups.sort((a, b) => {
      if (a.user.id === CURRENT_USER.id) return -1;
      if (b.user.id === CURRENT_USER.id) return 1;
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return 0;
    });
  }

  async getStoriesByUser(userId: string): Promise<Story[]> {
    const stories = this.getStoriesStore();
    const viewedIds = new Set(this.getViewedIds());
    return stories
      .filter((s) => s.author.id === userId && new Date(s.expiresAt).getTime() > Date.now())
      .map((s) => ({ ...s, isViewed: viewedIds.has(s.id) }));
  }

  async createStory(dto: CreateStoryDTO): Promise<Story> {
    const stories = this.getStoriesStore();
    const newStory: Story = {
      id: `story_${Date.now()}`,
      author: CURRENT_USER,
      mediaUrl: dto.mediaUrl,
      mediaType: dto.mediaType,
      caption: dto.caption,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      viewsCount: 0,
      isViewed: false,
    };

    const updated = [newStory, ...stories];
    this.saveStoriesStore(updated);
    return newStory;
  }

  async viewStory(storyId: string): Promise<void> {
    const viewedIds = this.getViewedIds();
    if (!viewedIds.includes(storyId)) {
      viewedIds.push(storyId);
      this.saveViewedIds(viewedIds);

      // Increment views count
      const stories = this.getStoriesStore();
      const target = stories.find((s) => s.id === storyId);
      if (target) {
        target.viewsCount += 1;
        this.saveStoriesStore(stories);
      }
    }
  }

  async deleteStory(storyId: string): Promise<boolean> {
    const stories = this.getStoriesStore();
    const filtered = stories.filter((s) => s.id !== storyId);
    this.saveStoriesStore(filtered);
    return true;
  }

  async getStoryViewers(_storyId: string): Promise<StoryViewerEntry[]> {
    // The mock keeps only a per-device viewed list, so there is no real viewer roster to show.
    return [];
  }
}
