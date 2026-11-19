import { Post, Comment } from '../../types';

export interface CreatePostDTO {
  content: string;
  images?: string[];
  feeling?: string;
  communityId?: string;
  communityName?: string;
  visibility?: 'public' | 'followers' | 'private';
  tags?: string[];
}

export interface IPostService {
  /**
   * Fetches home feed with specified tab ('forYou' | 'following' | 'latest')
   * Future Supabase hook: supabase.from('posts').select('*, profiles(*)').order('created_at', { ascending: false })
   */
  getFeed(tab: 'forYou' | 'following' | 'latest', communityId?: string): Promise<Post[]>;

  /** Subscribe to visible feed and interaction changes. Always return an unsubscribe function. */
  subscribeToFeed(onChange: () => void): () => void;

  /**
   * Fetches posts authored by a specific user.
   */
  getUserPosts(userId: string): Promise<Post[]>;

  /**
   * Fetches user's saved/bookmarked posts.
   */
  getBookmarkedPosts(): Promise<Post[]>;

  /**
   * Fetches a single post by id with comments.
   */
  getPostById(postId: string): Promise<Post | null>;

  /**
   * Creates a new post.
   * Future Supabase hook: supabase.from('posts').insert(postData)
   */
  createPost(dto: CreatePostDTO): Promise<Post>;

  /**
   * Edits an existing post owned by the caller.
   */
  updatePost(postId: string, content: string): Promise<Post>;

  /**
   * Deletes a post owned by the caller.
   */
  deletePost(postId: string): Promise<boolean>;

  /**
   * Toggles like state.
   */
  toggleLike(postId: string): Promise<{ isLiked: boolean; likesCount: number }>;

  /**
   * Toggles repost state.
   */
  toggleRepost(postId: string): Promise<{ isReposted: boolean; repostsCount: number }>;

  /**
   * Toggles bookmark state.
   */
  toggleBookmark(postId: string): Promise<boolean>;

  /**
   * Gets comments for a post.
   */
  getComments(postId: string): Promise<Comment[]>;

  /**
   * Adds a comment or reply to a post.
   */
  addComment(postId: string, content: string, parentCommentId?: string): Promise<Comment>;

  /**
   * Searches posts by keyword or hashtag.
   */
  searchPosts(query: string): Promise<Post[]>;
}
