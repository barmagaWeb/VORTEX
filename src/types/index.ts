export type Language = 'en' | 'ar';
export type Theme = 'dark' | 'light';

export interface User {
  id: string;
  email?: string;
  emailVerified?: boolean;
  name: string;
  username: string;
  avatar: string;
  coverImage?: string;
  bio?: string;
  location?: string;
  website?: string;
  verified?: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  joinedDate: string;
  isFollowing?: boolean;
  isFollowPending?: boolean;
  isBlocked?: boolean;
  isPrivate?: boolean;
  role: 'user' | 'admin' | 'moderator';
}

export interface Post {
  id: string;
  author: User;
  content: string;
  images?: string[];
  feeling?: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  sharesCount: number;
  isLiked?: boolean;
  isReposted?: boolean;
  isBookmarked?: boolean;
  communityId?: string;
  communityName?: string;
  tags?: string[];
  visibility: 'public' | 'followers' | 'private';
}

export interface Comment {
  id: string;
  postId: string;
  author: User;
  content: string;
  createdAt: string;
  likesCount: number;
  isLiked?: boolean;
  replies?: Comment[];
}

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatar: string;
  coverImage: string;
  memberCount: number;
  isMember?: boolean;
  isPrivate?: boolean;
  category: string;
  rules: string[];
  moderators: User[];
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId?: string;
  conversationId: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  attachments?: string[];
}

export interface Conversation {
  id: string;
  participant: User;
  lastMessage: Message;
  unreadCount: number;
  isOnline: boolean;
  isTyping?: boolean;
  isGroup?: boolean;
  groupName?: string;
  ownerId?: string;
}

export interface NotificationItem {
  id: string;
  type: 'like' | 'comment' | 'reply' | 'follow' | 'repost' | 'mention' | 'community' | 'message';
  actor: User;
  postId?: string;
  commentId?: string;
  communityId?: string;
  conversationId?: string;
  messageId?: string;
  postSnippet?: string;
  createdAt: string;
  isRead: boolean;
}

export interface Report {
  id: string;
  reportedItemType: 'post' | 'user' | 'comment' | 'community';
  reportedItemId: string;
  reportedItemSnippet: string;
  reportedByUser: User;
  reason: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'dismissed' | 'actioned';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  adminName: string;
  action: string;
  target: string;
  timestamp: string;
  status: 'success' | 'warning' | 'danger';
}

export interface PlatformMetrics {
  totalUsers: number;
  activeToday: number | null;
  totalPosts: number;
  totalCommunities: number;
  pendingReports: number;
  serverHealth: number | null;
}

export interface Story {
  id: string;
  author: User;
  mediaUrl: string;
  mediaType: 'image';
  caption?: string;
  createdAt: string;
  expiresAt: string;
  viewsCount: number;
  isViewed?: boolean;
}

export interface StoryGroup {
  user: User;
  stories: Story[];
  hasUnviewed: boolean;
}


export interface Hashtag {
  tag: string;
  postsCount: number;
  isTrending?: boolean;
}
