import { IPostService, CreatePostDTO } from '../interfaces/IPostService';
import { Post, Comment, User } from '../../types';
import { MOCK_POSTS, CURRENT_USER } from '../../constants/mockData';
import { storage } from './storage';

const STORAGE_KEY_POSTS = 'vortex_posts_store';
const STORAGE_KEY_COMMENTS = 'vortex_comments_store';

const INITIAL_COMMENTS: Record<string, Comment[]> = {
  post_1: [
    {
      id: 'com_1_1',
      postId: 'post_1',
      author: {
        id: 'usr_sara',
        name: 'Sara Ahmed',
        username: 'sara_ahmed',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
        followersCount: 28400,
        followingCount: 310,
        postsCount: 382,
        joinedDate: 'Feb 2024',
        verified: true,
        role: 'user',
      },
      content: 'مشهد مبهر وزاوية تصوير استثنائية! الإضاءة والظلال متناسقة جداً 🌆✨',
      createdAt: '1h ago',
      likesCount: 18,
      isLiked: true,
      replies: [
        {
          id: 'com_1_1_rep1',
          postId: 'post_1',
          author: CURRENT_USER,
          content: 'شكراً جزيلاً سارة! شهادة أعتز بها جداً 🌟',
          createdAt: '45m ago',
          likesCount: 6,
          isLiked: false,
        }
      ]
    },
    {
      id: 'com_1_2',
      postId: 'post_1',
      author: {
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
      content: 'Beautiful sunset shot. What camera gear did you use?',
      createdAt: '30m ago',
      likesCount: 7,
      isLiked: false,
    }
  ]
};

export class MockPostService implements IPostService {
  subscribeToFeed(_onChange: () => void): () => void {
    return () => undefined;
  }

  private getPostsStore(): Post[] {
    return storage.get<Post[]>(STORAGE_KEY_POSTS, MOCK_POSTS);
  }

  private savePostsStore(posts: Post[]): void {
    storage.set(STORAGE_KEY_POSTS, posts);
  }

  private getCommentsStore(): Record<string, Comment[]> {
    return storage.get<Record<string, Comment[]>>(STORAGE_KEY_COMMENTS, INITIAL_COMMENTS);
  }

  private saveCommentsStore(comments: Record<string, Comment[]>): void {
    storage.set(STORAGE_KEY_COMMENTS, comments);
  }

  async getFeed(tab: 'forYou' | 'following' | 'latest' = 'forYou', communityId?: string): Promise<Post[]> {
    let posts = this.getPostsStore();

    if (communityId) {
      return posts.filter((p) => p.communityId === communityId);
    }

    if (tab === 'following') {
      posts = posts.filter((p) => p.author.isFollowing || p.author.id === 'usr_me');
    } else if (tab === 'latest') {
      // Return reverse order or sorted
      posts = [...posts];
    }
    return posts;
  }

  async getUserPosts(userId: string): Promise<Post[]> {
    const posts = this.getPostsStore();
    return posts.filter((p) => p.author.id === userId);
  }

  async getBookmarkedPosts(): Promise<Post[]> {
    const posts = this.getPostsStore();
    return posts.filter((p) => p.isBookmarked);
  }

  async getPostById(postId: string): Promise<Post | null> {
    const posts = this.getPostsStore();
    return posts.find((p) => p.id === postId) || null;
  }

  async createPost(dto: CreatePostDTO, author: User = CURRENT_USER): Promise<Post> {
    const posts = this.getPostsStore();
    const newPost: Post = {
      id: `post_${Date.now()}`,
      author,
      content: dto.content,
      images: dto.images && dto.images.length > 0 ? dto.images : undefined,
      feeling: dto.feeling,
      communityId: dto.communityId,
      communityName: dto.communityName,
      visibility: dto.visibility || 'public',
      tags: dto.tags || [],
      createdAt: 'Just now',
      likesCount: 0,
      commentsCount: 0,
      repostsCount: 0,
      sharesCount: 0,
      isLiked: false,
      isReposted: false,
      isBookmarked: false,
    };
    const updated = [newPost, ...posts];
    this.savePostsStore(updated);
    return newPost;
  }

  async updatePost(postId: string, content: string): Promise<Post> {
    const posts = this.getPostsStore();
    const index = posts.findIndex((p) => p.id === postId);
    if (index === -1) throw new Error('Post not found');
    posts[index].content = content;
    this.savePostsStore(posts);
    return posts[index];
  }

  async deletePost(postId: string): Promise<boolean> {
    const posts = this.getPostsStore();
    const filtered = posts.filter((p) => p.id !== postId);
    this.savePostsStore(filtered);
    return true;
  }

  async toggleLike(postId: string): Promise<{ isLiked: boolean; likesCount: number }> {
    const posts = this.getPostsStore();
    const post = posts.find((p) => p.id === postId);
    if (!post) throw new Error('Post not found');

    const isLiked = !post.isLiked;
    post.isLiked = isLiked;
    post.likesCount = isLiked ? post.likesCount + 1 : Math.max(0, post.likesCount - 1);
    this.savePostsStore(posts);
    return { isLiked, likesCount: post.likesCount };
  }

  async toggleRepost(postId: string): Promise<{ isReposted: boolean; repostsCount: number }> {
    const posts = this.getPostsStore();
    const post = posts.find((p) => p.id === postId);
    if (!post) throw new Error('Post not found');

    const isReposted = !post.isReposted;
    post.isReposted = isReposted;
    post.repostsCount = isReposted ? post.repostsCount + 1 : Math.max(0, post.repostsCount - 1);
    this.savePostsStore(posts);
    return { isReposted, repostsCount: post.repostsCount };
  }

  async toggleBookmark(postId: string): Promise<boolean> {
    const posts = this.getPostsStore();
    const post = posts.find((p) => p.id === postId);
    if (!post) throw new Error('Post not found');

    post.isBookmarked = !post.isBookmarked;
    this.savePostsStore(posts);
    return !!post.isBookmarked;
  }

  async getComments(postId: string): Promise<Comment[]> {
    const store = this.getCommentsStore();
    return store[postId] || [];
  }

  async addComment(postId: string, content: string, parentCommentId?: string): Promise<Comment> {
    const store = this.getCommentsStore();
    const postComments = store[postId] || [];

    const newComment: Comment = {
      id: `com_${Date.now()}`,
      postId,
      author: CURRENT_USER,
      content,
      createdAt: 'Just now',
      likesCount: 0,
      isLiked: false,
    };

    if (parentCommentId) {
      const parent = postComments.find((c) => c.id === parentCommentId);
      if (parent) {
        if (!parent.replies) parent.replies = [];
        parent.replies.push(newComment);
      } else {
        postComments.push(newComment);
      }
    } else {
      postComments.push(newComment);
    }

    store[postId] = postComments;
    this.saveCommentsStore(store);

    // Also increment commentsCount on post
    const posts = this.getPostsStore();
    const targetPost = posts.find((p) => p.id === postId);
    if (targetPost) {
      targetPost.commentsCount += 1;
      this.savePostsStore(posts);
    }

    return newComment;
  }

  async searchPosts(query: string): Promise<Post[]> {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const posts = this.getPostsStore();
    return posts.filter(
      (p) =>
        p.content.toLowerCase().includes(q) ||
        p.author.name.toLowerCase().includes(q) ||
        p.author.username.toLowerCase().includes(q) ||
        (p.tags && p.tags.some((t) => t.toLowerCase().includes(q.replace('#', ''))))
    );
  }
}
