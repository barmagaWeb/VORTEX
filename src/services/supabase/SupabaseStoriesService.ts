import { IStoriesService, CreateStoryDTO } from '../interfaces/IStoriesService';
import { Story, StoryGroup, StoryViewerEntry, User } from '../../types';
import { supabase, isSupabaseConfigured } from './client';
import { MockStoriesService } from '../mock/MockStoriesService';
import { resolveStorageUrl, resolveStorageUrls } from './storage';

interface StoryProfileRow {
  id?: string;
  name?: string | null;
  username?: string | null;
  avatar?: string | null;
  verified?: boolean | null;
  followers_count?: number | null;
  following_count?: number | null;
  posts_count?: number | null;
  created_at?: string | null;
  role?: User['role'] | null;
}

interface StoryViewRow {
  viewer_id: string;
}

interface StoryDatabaseRow {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  views_count: number | null;
  profiles?: StoryProfileRow | null;
  story_views?: StoryViewRow[] | null;
}

export class SupabaseStoriesService implements IStoriesService {
  private fallbackMock = new MockStoriesService();

  private async mapDbStoryToDomain(row: StoryDatabaseRow, currentUserId?: string, resolvedMediaUrl?: string): Promise<Story> {
    const isViewed = Array.isArray(row.story_views)
      ? row.story_views.some((view) => view.viewer_id === currentUserId)
      : false;

    const author: User = {
      id: row.profiles?.id || row.user_id,
      name: row.profiles?.name || 'VORTEX Member',
      username: row.profiles?.username || '',
      avatar: row.profiles?.avatar || '',
      verified: row.profiles?.verified || false,
      followersCount: row.profiles?.followers_count || 0,
      followingCount: row.profiles?.following_count || 0,
      postsCount: row.profiles?.posts_count || 0,
      joinedDate: row.profiles?.created_at ? new Date(row.profiles.created_at).toLocaleDateString() : '',
      role: row.profiles?.role || 'user',
    };

    return {
      id: row.id,
      author,
      mediaUrl: resolvedMediaUrl ?? await resolveStorageUrl('story_media', row.media_url),
      mediaType: 'image',
      caption: row.caption ?? undefined,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      viewsCount: row.views_count || 0,
      isViewed,
    };
  }

  async getStoryGroups(): Promise<StoryGroup[]> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getStoryGroups();
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;

      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          profiles:user_id(*),
          story_views(viewer_id)
        `)
        .gt('expires_at', new Date().toISOString())
        .eq('media_type', 'image')
      .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      if (!data) return [];
      const storyRows = data as unknown as StoryDatabaseRow[];

      const mediaUrls = await resolveStorageUrls('story_media', storyRows.map((row) => row.media_url));
      const groupMap = new Map<string, { user: User; stories: Story[] }>();

      for (const [index, row] of storyRows.entries()) {
        const story = await this.mapDbStoryToDomain(row, currentUserId, mediaUrls[index]);
        if (!groupMap.has(story.author.id)) {
          groupMap.set(story.author.id, {
            user: story.author,
            stories: [story],
          });
        } else {
          groupMap.get(story.author.id)!.stories.push(story);
        }
      }

      const groups: StoryGroup[] = [];
      for (const [, val] of groupMap.entries()) {
        groups.push({
          user: val.user,
          stories: val.stories,
          hasUnviewed: val.stories.some((s) => !s.isViewed),
        });
      }

      return groups;
    } catch (error) {
      throw error;
    }
  }

  async getStoriesByUser(userId: string): Promise<Story[]> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getStoriesByUser(userId);
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;

      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          profiles:user_id(*),
          story_views(viewer_id)
        `)
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .eq('media_type', 'image')
        .order('created_at', { ascending: true });

      if (error) throw new Error(error.message);
      if (!data) return [];
      const storyRows = data as unknown as StoryDatabaseRow[];
      const mediaUrls = await resolveStorageUrls('story_media', storyRows.map((row) => row.media_url));
      return Promise.all(storyRows.map((row, index) => this.mapDbStoryToDomain(row, currentUserId, mediaUrls[index])));
    } catch (error) {
      throw error;
    }
  }

  async createStory(dto: CreateStoryDTO): Promise<Story> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.createStory(dto);
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('stories')
        .insert({
          user_id: authData.user.id,
          media_url: dto.mediaUrl,
          media_type: 'image',
          caption: dto.caption,
        })
        .select(`
          *,
          profiles:user_id(*)
        `)
        .single();

      if (error) throw new Error(error.message);
      if (!data) throw new Error('Story was not created');
      return await this.mapDbStoryToDomain(data as unknown as StoryDatabaseRow, authData.user.id);
    } catch (error) {
      throw error;
    }
  }

  async viewStory(storyId: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.viewStory(storyId);
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      const { error } = await supabase
        .from('story_views')
        .upsert(
          { story_id: storyId, viewer_id: authData.user.id },
          { onConflict: 'story_id,viewer_id', ignoreDuplicates: true }
        );
      if (error) throw new Error(error.message);
    } catch (error) {
      throw error;
    }
  }

  async deleteStory(storyId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.deleteStory(storyId);
    }

    try {
      const { error } = await supabase.from('stories').delete().eq('id', storyId);
      if (error) throw new Error(error.message);
      return true;
    } catch (error) {
      throw error;
    }
  }

  async getStoryViewers(storyId: string): Promise<StoryViewerEntry[]> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getStoryViewers(storyId);
    }

    // RLS ("Story owners viewers and moderators view story receipts") decides who may read these rows;
    // for anyone but the story owner this simply returns an empty list.
    const { data, error } = await supabase
      .from('story_views')
      .select('viewed_at, profiles:viewer_id(id, name, username, avatar, verified, followers_count, following_count, posts_count, created_at, role)')
      .eq('story_id', storyId)
      .order('viewed_at', { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as Array<{ viewed_at: string; profiles: StoryProfileRow | StoryProfileRow[] | null }>;
    return rows.flatMap((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      if (!profile?.id) return [];
      const user: User = {
        id: profile.id,
        name: profile.name || 'VORTEX Member',
        username: profile.username || '',
        avatar: profile.avatar || '',
        verified: profile.verified || false,
        followersCount: profile.followers_count || 0,
        followingCount: profile.following_count || 0,
        postsCount: profile.posts_count || 0,
        joinedDate: profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '',
        role: profile.role || 'user',
      };
      return [{ user, viewedAt: row.viewed_at }];
    });
  }
}
