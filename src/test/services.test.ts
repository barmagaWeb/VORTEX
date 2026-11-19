import { describe, it, expect, beforeEach } from 'vitest';
import { MockAuthService } from '../services/mock/MockAuthService';
import { MockUserService } from '../services/mock/MockUserService';
import { MockPostService } from '../services/mock/MockPostService';
import { MockMessagingService } from '../services/mock/MockMessagingService';
import { MockCommunityService } from '../services/mock/MockCommunityService';
import { MockAdminService } from '../services/mock/MockAdminService';

describe('VORTEX Mock Services Suite', () => {
  beforeEach(() => {
    // Clear in-memory / local storage before each test
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  describe('MockAuthService', () => {
    const auth = new MockAuthService();

    it('should return default user or logged-in user', async () => {
      const current = await auth.getCurrentUser();
      expect(current).not.toBeNull();
      expect(current?.name).toBe('Ahmed Mohamed');
    });

    it('should sign in as admin when admin email provided', async () => {
      const user = await auth.signIn('elena_admin@vortex.social');
      expect(user.role).toBe('admin');
      expect(user.username).toBe('elena_admin');
    });

    it('should not grant admin access for an arbitrary email containing admin', async () => {
      const user = await auth.signIn('ordinary-admin-helper@example.com');
      expect(user.role).toBe('user');
      expect(user.username).toBe('ahmedmohamed');
    });

    it('should allow signing up a new user', async () => {
      const newUser = await auth.signUp('test@vortex.social', 'password123', 'Test Pioneer', 'test_pioneer');
      expect(newUser.name).toBe('Test Pioneer');
      expect(newUser.username).toBe('test_pioneer');
      expect(newUser.followersCount).toBe(0);
    });

    it('should switch demo personas', async () => {
      const admin = await auth.switchDemoRole('admin');
      expect(admin.role).toBe('admin');
      const standard = await auth.switchDemoRole('user');
      expect(standard.role).toBe('user');
    });
  });

  describe('MockUserService', () => {
    const userService = new MockUserService();

    it('should find user by username', async () => {
      const user = await userService.getUserByUsername('ahmedmohamed');
      expect(user).not.toBeNull();
      expect(user?.name).toBe('Ahmed Mohamed');
    });

    it('should toggle follow state and update count', async () => {
      const res = await userService.toggleFollow('usr_sara');
      expect(res).toHaveProperty('isFollowing');
      expect(res).toHaveProperty('newFollowersCount');
    });

    it('should search users by query', async () => {
      const results = await userService.searchUsers('Ahmed');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((u) => u.name.includes('Ahmed'))).toBe(true);
    });

    it('should update user profile fields', async () => {
      const updated = await userService.updateProfile('usr_me', { bio: 'Updated bio testing' });
      expect(updated.bio).toBe('Updated bio testing');
    });
  });

  describe('MockPostService', () => {
    const postService = new MockPostService();

    it('should fetch home feed posts', async () => {
      const feed = await postService.getFeed('forYou');
      expect(feed.length).toBeGreaterThan(0);
      expect(feed[0]).toHaveProperty('content');
    });

    it('should create a new post and place it at top of feed', async () => {
      const newPost = await postService.createPost({
        content: 'Testing automated creation in VORTEX #Vitest #Testing',
        tags: ['vitest', 'testing'],
      });
      expect(newPost.content).toContain('Testing automated creation');

      const feed = await postService.getFeed('forYou');
      expect(feed[0].id).toBe(newPost.id);
    });

    it('should toggle like on a post', async () => {
      const feed = await postService.getFeed('forYou');
      const target = feed[0];
      const initialLikes = target.likesCount;
      const initialIsLiked = target.isLiked;

      const res = await postService.toggleLike(target.id);
      expect(res.isLiked).toBe(!initialIsLiked);
      expect(res.likesCount).toBe(initialIsLiked ? initialLikes - 1 : initialLikes + 1);
    });

    it('should toggle bookmark on a post', async () => {
      const feed = await postService.getFeed('forYou');
      const target = feed[0];
      const initialBookmarked = target.isBookmarked;

      const res = await postService.toggleBookmark(target.id);
      expect(res).toBe(!initialBookmarked);
    });

    it('should add a comment to a post', async () => {
      const feed = await postService.getFeed('forYou');
      const target = feed[0];

      const comment = await postService.addComment(target.id, 'Super insightful thoughts!');
      expect(comment.content).toBe('Super insightful thoughts!');

      const comments = await postService.getComments(target.id);
      expect(comments.some((c) => c.content === 'Super insightful thoughts!')).toBe(true);
    });
  });

  describe('MockMessagingService', () => {
    const messaging = new MockMessagingService();

    it('should return initial conversations', async () => {
      const convs = await messaging.getConversations();
      expect(convs.length).toBeGreaterThan(0);
      expect(convs[0].participant).toBeDefined();
    });

    it('should send a message and retrieve updated message list', async () => {
      const convs = await messaging.getConversations();
      const active = convs[0];

      const sent = await messaging.sendMessage(active.id, 'Hello from unit test');
      expect(sent.content).toBe('Hello from unit test');

      const messages = await messaging.getMessages(active.id);
      expect(messages.some((m) => m.content === 'Hello from unit test')).toBe(true);
    });
  });

  describe('MockCommunityService', () => {
    const communityService = new MockCommunityService();

    it('should retrieve communities list', async () => {
      const communities = await communityService.getCommunities();
      expect(communities.length).toBeGreaterThan(0);
    });

    it('should toggle community membership', async () => {
      const communities = await communityService.getCommunities();
      const target = communities[0];
      const initialStatus = target.isMember;

      const res = await communityService.toggleMembership(target.id);
      expect(res.isMember).toBe(!initialStatus);
    });

    it('should create a new community', async () => {
      const newComm = await communityService.createCommunity({
        name: 'Distributed Systems Club',
        description: 'Deep dive into Paxos, Raft and Byzantine fault tolerance',
        category: 'Technology',
      });
      expect(newComm.name).toBe('Distributed Systems Club');
      expect(newComm.slug).toBe('distributed-systems-club');
    });
  });

  describe('MockAdminService', () => {
    const admin = new MockAdminService();

    it('should return platform health metrics', async () => {
      const metrics = await admin.getMetrics();
      expect(metrics.totalUsers).toBeGreaterThan(0);
      expect(metrics.serverHealth).toBeGreaterThanOrEqual(99.0);
    });

    it('should resolve a moderation report', async () => {
      const reports = await admin.getReports();
      expect(reports.length).toBeGreaterThan(0);
      const pending = reports.find((r) => r.status === 'pending');
      if (pending) {
        await admin.resolveReport(pending.id, 'dismiss');
        const updated = await admin.getReports();
        const found = updated.find((r) => r.id === pending.id);
        expect(found?.status).toBe('dismissed');
      }
    });
  });
});
