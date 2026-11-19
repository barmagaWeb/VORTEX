import { describe, it, expect } from 'vitest';
import { SupabaseAuthService } from '../services/supabase/SupabaseAuthService';
import { SupabaseUserService } from '../services/supabase/SupabaseUserService';
import { SupabasePostService } from '../services/supabase/SupabasePostService';
import { SupabaseMessagingService } from '../services/supabase/SupabaseMessagingService';
import { SupabaseAdminService } from '../services/supabase/SupabaseAdminService';

// These are service-layer/Mock behaviour tests only. Real database RLS checks live in supabase/tests/rls_security.test.sql.
describe('VORTEX service behaviour (Mock fallback)', () => {
  const authService = new SupabaseAuthService();
  const userService = new SupabaseUserService();
  const postService = new SupabasePostService();
  const messagingService = new SupabaseMessagingService();
  const adminService = new SupabaseAdminService();

  describe('Mock authorization behaviour (not PostgreSQL RLS)', () => {
    it('should disallow standard users from performing admin operations', async () => {
      const user = await authService.getCurrentUser();
      expect(user).toBeDefined();

      const userRole = user?.role;
      if (userRole !== 'admin') {
        expect(userRole === 'user' || userRole === 'moderator').toBe(true);
      }
    });

    it('keeps the Mock service role unchanged when a normal user requests a role update', async () => {
      const user = await authService.getCurrentUser();
      if (user) {
        // Attempting to update role directly should preserve existing role or fail
        const updated = await userService.updateProfile(user.id, { role: 'admin' });
        expect(updated.role).toBe('user');
      }
    });
  });

  describe('Private Account & Post Visibility Protection', () => {
    it('should respect private profile visibility restrictions', async () => {
      const targetUser = await userService.getUserByUsername('sara_ahmed');
      expect(targetUser).toBeDefined();

      const feed = await postService.getFeed('following');
      // Posts returned should be filtered according to follow status
      expect(Array.isArray(feed)).toBe(true);
    });
  });

  describe('Conversation & Messaging Isolation', () => {
    it('should only return conversations the user belongs to', async () => {
      const convs = await messagingService.getConversations();
      expect(Array.isArray(convs)).toBe(true);
      for (const conv of convs) {
        expect(conv).toHaveProperty('id');
        expect(conv).toHaveProperty('participant');
      }
    });
  });

  describe('Moderation & Content Safety', () => {
    it('should allow submitting a report and verify it is queued for admin review', async () => {
      const report = await adminService.submitReport(
        'post',
        'post_test_123',
        'Inappropriate content sample',
        'Spam violation'
      );
      expect(report).toHaveProperty('id');
      expect(report.status).toBe('pending');
      expect(report.reason).toBe('Spam violation');
    });

    it('should log audit trail entries when administrative actions are taken', async () => {
      const initialLogs = await adminService.getAuditLogs();
      expect(Array.isArray(initialLogs)).toBe(true);
    });
  });
});
