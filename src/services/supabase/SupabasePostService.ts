import { IPostService, CreatePostDTO } from '../interfaces/IPostService';
import { Post, Comment, User } from '../../types';
import { supabase, isSupabaseConfigured } from './client';
import { MockPostService } from '../mock/MockPostService';
import { resolveStorageUrls } from './storage';
import { escapeLikeLiteral } from './query';

export class SupabasePostService implements IPostService {
  private fallbackMock = new MockPostService();

  subscribeToFeed(onChange: () => void): () => void {
    if (!isSupabaseConfigured()) return this.fallbackMock.subscribeToFeed(onChange);
    const channel = supabase
      .channel(`vortex-feed-${crypto.randomUUID()}`)
      // New-post notifications are enough to surface a refresh affordance.
      // Likes, comments, reposts and follow changes no longer refetch every feed.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, onChange)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }

  private filterInteractionRowsToCurrentUser(query: any, currentUserId?: string): any {
    if (!currentUserId) return query;
    // Embedded relationship filters limit the nested rows returned without
    // filtering out parent posts (these embeds do not use !inner).
    return query
      .eq('post_likes.user_id', currentUserId)
      .eq('bookmarks.user_id', currentUserId)
      .eq('reposts.user_id', currentUserId);
  }

  private async mapDbPostToDomain(row: any, currentUserId?: string, resolvedImages?: string[]): Promise<Post> {
    const isLiked = Array.isArray(row.post_likes)
      ? row.post_likes.some((l: any) => l.user_id === currentUserId)
      : false;
    const isBookmarked = Array.isArray(row.bookmarks)
      ? row.bookmarks.some((b: any) => b.user_id === currentUserId)
      : false;
    const isReposted = Array.isArray(row.reposts)
      ? row.reposts.some((r: any) => r.user_id === currentUserId)
      : false;

    const storedImages: string[] = Array.isArray(row.post_media)
      ? row.post_media.filter((media: { media_type?: string; media_url?: unknown }) => media.media_type === 'image').map((media: { media_url?: unknown }) => media.media_url).filter((value: unknown): value is string => typeof value === 'string')
      : [];
    const images = resolvedImages ?? await resolveStorageUrls('post_media', storedImages);

    const author: User = {
      id: row.profiles?.id || row.author_id,
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
      content: row.content,
      images: images.length > 0 ? images : undefined,
      feeling: row.feeling,
      communityId: row.community_id,
      communityName: row.communities?.name,
      visibility: row.visibility || 'public',
      tags: row.tags || [],
      likesCount: row.likes_count || 0,
      commentsCount: row.comments_count || 0,
      repostsCount: row.reposts_count || 0,
      sharesCount: row.shares_count || 0,
      isLiked,
      isBookmarked,
      isReposted,
      createdAt: row.created_at ? new Date(row.created_at).toLocaleString() : 'Recently',
    };
  }

  private async mapDbPostsToDomain(rows: any[], currentUserId?: string): Promise<Post[]> {
    const imagePathsByPost = rows.map((row) => Array.isArray(row.post_media)
      ? row.post_media
          .filter((media: { media_type?: string; media_url?: unknown }) => media.media_type === 'image')
          .map((media: { media_url?: unknown }) => media.media_url)
          .filter((value: unknown): value is string => typeof value === 'string')
      : []);
    const allPaths = imagePathsByPost.flat();
    const signedUrls = await resolveStorageUrls('post_media', allPaths);
    let cursor = 0;
    return Promise.all(rows.map((row, index) => {
      const imageCount = imagePathsByPost[index].length;
      const imageUrls = signedUrls.slice(cursor, cursor + imageCount);
      cursor += imageCount;
      return this.mapDbPostToDomain(row, currentUserId, imageUrls);
    }));
  }

  async getFeed(tab: 'forYou' | 'following' | 'latest' = 'forYou', communityId?: string): Promise<Post[]> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getFeed(tab, communityId);
    }

    const { data: { user } } = await supabase.auth.getUser();

    const postSelection = `
      *,
      profiles!posts_author_id_fkey(*),
      communities:communities!posts_community_id_fkey(id, name),
      post_media(media_url, media_type),
      post_likes(user_id),
      bookmarks(user_id),
      reposts(user_id)
    `;

    let query: any;
    if (tab === 'following' && user) {
      query = supabase.rpc('get_following_feed', {
        page_limit: 30,
        page_offset: 0,
        target_community_id: communityId || null,
      }).select(postSelection);
    } else if (tab === 'forYou') {
      query = supabase.rpc('get_for_you_feed', {
        page_limit: 30,
        page_offset: 0,
        target_community_id: communityId || null,
      }).select(postSelection);
    } else {
      query = supabase.from('posts').select(postSelection);
      if (communityId) query = query.eq('community_id', communityId);
      query = query.order('created_at', { ascending: false }).order('id', { ascending: false });
    }

    query = this.filterInteractionRowsToCurrentUser(query, user?.id);
    const { data, error } = await query.limit(30);
    if (error) throw new Error(`Unable to load feed: ${error.message}`);
    if (!data) return [];

    return this.mapDbPostsToDomain(data, user?.id);
  }

  async getUserPosts(userId: string): Promise<Post[]> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getUserPosts(userId);
    }

    const { data: { user } } = await supabase.auth.getUser();
    let query = supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_author_id_fkey(*),
        communities:communities!posts_community_id_fkey(id, name),
        post_media(media_url, media_type),
        post_likes(user_id),
        bookmarks(user_id),
        reposts(user_id)
      `)
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });
    query = this.filterInteractionRowsToCurrentUser(query, user?.id);
    const { data, error } = await query.limit(30);

    if (error) throw new Error(`Unable to load user posts: ${error.message}`);
    if (!data) return [];
    return this.mapDbPostsToDomain(data, user?.id);
  }

  async getBookmarkedPosts(): Promise<Post[]> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getBookmarkedPosts();
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('bookmarks')
      .select(`
        post_id,
        posts (
          *,
          profiles!posts_author_id_fkey(*),
          communities:communities!posts_community_id_fkey(id, name),
          post_media(media_url, media_type),
          post_likes(user_id),
          bookmarks(user_id),
          reposts(user_id)
        )
      `)
      .eq('user_id', user.id)
      .eq('posts.post_likes.user_id', user.id)
      .eq('posts.bookmarks.user_id', user.id)
      .eq('posts.reposts.user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw new Error(`Unable to load bookmarks: ${error.message}`);
    if (!data) return [];
    const bookmarkedPosts = data
      .map((entry: any) => Array.isArray(entry.posts) ? entry.posts[0] : entry.posts)
      .filter((post: any) => post && typeof post.id === 'string');
    return this.mapDbPostsToDomain(bookmarkedPosts, user.id);
  }

  async getPostById(postId: string): Promise<Post | null> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getPostById(postId);
    }

    const { data: { user } } = await supabase.auth.getUser();
    let query = supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_author_id_fkey(*),
        communities:communities!posts_community_id_fkey(id, name),
        post_media(media_url, media_type),
        post_likes(user_id),
        bookmarks(user_id),
        reposts(user_id)
      `)
      .eq('id', postId);
    query = this.filterInteractionRowsToCurrentUser(query, user?.id);
    const { data, error } = await query.single();

    if (error || !data) return null;
    return this.mapDbPostToDomain(data, user?.id);
  }

  async createPost(dto: CreatePostDTO): Promise<Post> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.createPost(dto);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const { data: newPost, error } = await supabase
      .from('posts')
      .insert({
        author_id: user.id,
        content: dto.content,
        feeling: dto.feeling,
        community_id: dto.communityId,
        visibility: dto.visibility || 'public',
        tags: dto.tags || [],
      })
      .select('*, profiles!posts_author_id_fkey(*)')
      .single();

    if (error) throw new Error(error.message);

    // Insert media if present
    if (dto.images && dto.images.length > 0) {
      const mediaRows = dto.images.map((url, idx) => ({
        post_id: newPost.id,
        media_url: url,
        media_type: 'image',
        display_order: idx,
      }));
      const { error: mediaError } = await supabase.from('post_media').insert(mediaRows);
      if (mediaError) {
        await supabase.from('posts').delete().eq('id', newPost.id);
        throw new Error(mediaError.message);
      }
      newPost.post_media = mediaRows;
    }

    return this.mapDbPostToDomain(newPost, user.id);
  }

  async updatePost(postId: string, content: string): Promise<Post> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.updatePost(postId, content);
    }

    const { data: { user } } = await supabase.auth.getUser();
    let query = supabase
      .from('posts')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', postId)
      .select(`
        *,
        profiles!posts_author_id_fkey(*),
        communities:communities!posts_community_id_fkey(id, name),
        post_media(media_url, media_type),
        post_likes(user_id),
        bookmarks(user_id),
        reposts(user_id)
      `);
    query = this.filterInteractionRowsToCurrentUser(query, user?.id);
    const { data, error } = await query.single();

    if (error) throw new Error(error.message);
    return this.mapDbPostToDomain(data, user?.id);
  }

  async deletePost(postId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.deletePost(postId);
    }

    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) throw new Error(error.message);
    return true;
  }

  async toggleLike(postId: string): Promise<{ isLiked: boolean; likesCount: number }> {
    if (!isSupabaseConfigured()) return this.fallbackMock.toggleLike(postId);

    const { data, error } = await supabase.rpc('toggle_post_like', { target_post_id: postId });
    if (error) throw new Error(error.message);
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error('Like action did not return a result.');
    return { isLiked: Boolean(result.is_liked), likesCount: Number(result.likes_count) || 0 };
  }

  async toggleRepost(postId: string): Promise<{ isReposted: boolean; repostsCount: number }> {
    if (!isSupabaseConfigured()) return this.fallbackMock.toggleRepost(postId);

    const { data, error } = await supabase.rpc('toggle_post_repost', { target_post_id: postId });
    if (error) throw new Error(error.message);
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error('Repost action did not return a result.');
    return { isReposted: Boolean(result.is_reposted), repostsCount: Number(result.reposts_count) || 0 };
  }

  async toggleBookmark(postId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return this.fallbackMock.toggleBookmark(postId);

    const { data, error } = await supabase.rpc('toggle_post_bookmark', { target_post_id: postId });
    if (error) throw new Error(error.message);
    if (typeof data !== 'boolean') throw new Error('Bookmark action did not return a result.');
    return data;
  }

  async getComments(postId: string): Promise<Comment[]> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getComments(postId);
    }

    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles!comments_author_id_fkey(*)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(100);

    if (error) throw new Error(`Unable to load comments: ${error.message}`);
    if (!data) return [];

    return [...data].reverse().map((c) => ({
      id: c.id,
      postId: c.post_id,
      author: {
        id: c.profiles?.id || c.author_id,
        name: c.profiles?.name || 'VORTEX Member',
        username: c.profiles?.username || '',
        avatar: c.profiles?.avatar || '',
        followersCount: c.profiles?.followers_count || 0,
        followingCount: c.profiles?.following_count || 0,
        postsCount: c.profiles?.posts_count || 0,
        joinedDate: c.profiles?.created_at ? new Date(c.profiles.created_at).toLocaleDateString() : '',
        role: c.profiles?.role || 'user',
        verified: c.profiles?.verified || false,
      },
      content: c.content,
      createdAt: new Date(c.created_at).toLocaleString(),
      likesCount: c.likes_count || 0,
    }));
  }

  async addComment(postId: string, content: string, parentCommentId?: string): Promise<Comment> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.addComment(postId, content, parentCommentId);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        author_id: user.id,
        parent_comment_id: parentCommentId,
        content,
      })
      .select('*, profiles!comments_author_id_fkey(*)')
      .single();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      postId: data.post_id,
      author: {
        id: data.profiles?.id || user.id,
        name: data.profiles?.name || String(user.user_metadata?.name || 'VORTEX Member'),
        username: data.profiles?.username || String(user.user_metadata?.username || ''),
        avatar: data.profiles?.avatar || '',
        followersCount: data.profiles?.followers_count || 0,
        followingCount: data.profiles?.following_count || 0,
        postsCount: data.profiles?.posts_count || 0,
        joinedDate: data.profiles?.created_at ? new Date(data.profiles.created_at).toLocaleDateString() : '',
        role: data.profiles?.role || 'user',
        verified: data.profiles?.verified || false,
      },
      content: data.content,
      createdAt: new Date(data.created_at).toLocaleString(),
      likesCount: 0,
    };
  }

  async searchPosts(query: string): Promise<Post[]> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.searchPosts(query);
    }

    const q = query.trim();
    if (!q) return [];

    const { data: { user } } = await supabase.auth.getUser();
    const postSelection = `
      *,
      profiles!posts_author_id_fkey(*),
      communities:communities!posts_community_id_fkey(id, name),
      post_media(media_url, media_type),
      post_likes(user_id),
      bookmarks(user_id),
      reposts(user_id)
    `;

    if (q.startsWith('#')) {
      const tagName = q.slice(1).trim().toLowerCase();
      if (!tagName) return [];
      const { data, error } = await supabase
        .from('post_hashtags')
        .select(`post_id, hashtags!inner(name), posts!inner(${postSelection})`)
        .eq('hashtags.name', tagName)
        .eq('posts.post_likes.user_id', user?.id || '00000000-0000-0000-0000-000000000000')
        .eq('posts.bookmarks.user_id', user?.id || '00000000-0000-0000-0000-000000000000')
        .eq('posts.reposts.user_id', user?.id || '00000000-0000-0000-0000-000000000000')
        .limit(30);

      if (error) throw new Error(error.message);
      const posts = (data || [])
        .map((entry: any) => entry.posts)
        .filter((post: any) => post && typeof post.id === 'string');
      return this.mapDbPostsToDomain(posts, user?.id);
    }

    let searchQuery = supabase
      .from('posts')
      .select(postSelection)
      .ilike('content', `%${escapeLikeLiteral(q)}%`);
    searchQuery = this.filterInteractionRowsToCurrentUser(searchQuery, user?.id);
    const { data, error } = await searchQuery.limit(30);

    if (error) throw new Error(error.message);
    if (!data) return [];
    return this.mapDbPostsToDomain(data, user?.id);
  }
}
