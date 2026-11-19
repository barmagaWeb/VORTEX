import { IAdminService } from '../interfaces/IAdminService';
import { PlatformMetrics, Report, User, AuditLog } from '../../types';
import { supabase, isSupabaseConfigured } from './client';
import { MockAdminService } from '../mock/MockAdminService';

export class SupabaseAdminService implements IAdminService {
  private fallbackMock = new MockAdminService();

  async getMetrics(): Promise<PlatformMetrics> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getMetrics();
    }

    const [usersResult, postsResult, communitiesResult, reportsResult] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('posts').select('*', { count: 'exact', head: true }),
      supabase.from('communities').select('*', { count: 'exact', head: true }),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    const failed = [usersResult, postsResult, communitiesResult, reportsResult].find((result) => result.error);
    if (failed?.error) throw new Error(`Unable to load platform metrics: ${failed.error.message}`);

    return {
      totalUsers: usersResult.count ?? 0,
      // Presence/last-seen telemetry is not implemented, so do not fabricate an active-user count.
      activeToday: null,
      totalPosts: postsResult.count ?? 0,
      totalCommunities: communitiesResult.count ?? 0,
      pendingReports: reportsResult.count ?? 0,
      // Database health is reported by Supabase Advisors, not inferred by the browser client.
      serverHealth: null,
    };
  }

  async getReports(status: 'all' | 'pending' | 'reviewed' = 'all'): Promise<Report[]> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getReports(status);
    }

    let query = supabase
      .from('reports')
      .select('*, profiles!reports_reported_by_fkey(*)');

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(`Unable to load reports: ${error.message}`);
    if (!data) return [];

    return data.map((d: any) => ({
      id: d.id,
      reportedItemType: d.reported_item_type,
      reportedItemId: d.reported_item_id,
      reportedItemSnippet: d.reported_item_snippet,
      reportedByUser: {
        id: d.profiles?.id || 'usr_reporter',
        name: d.profiles?.name || 'Reporter',
        username: d.profiles?.username || 'reporter',
        avatar: d.profiles?.avatar || '',
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        joinedDate: '2024',
        role: 'user',
      },
      reason: d.reason,
      details: d.details,
      status: d.status,
      createdAt: new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));
  }

  async resolveReport(reportId: string, action: 'dismiss' | 'actioned'): Promise<void> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.resolveReport(reportId, action);
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Authentication required');

    const { data: updated, error: updateError } = await supabase
      .from('reports')
      .update({
        status: action === 'dismiss' ? 'dismissed' : 'actioned',
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (updateError) throw new Error(`Unable to update report: ${updateError.message}`);
    if (!updated) throw new Error('This report was already handled or is unavailable.');

    const { error: auditError } = await supabase.from('admin_audit_logs').insert({
      admin_id: user.id,
      admin_name: user.user_metadata?.name || 'Admin',
      action: action === 'dismiss' ? 'Dismissed Report' : 'Marked Report Actioned',
      target: reportId,
      status: action === 'dismiss' ? 'warning' : 'danger',
    });
    if (auditError) throw new Error(`Report updated, but audit logging failed: ${auditError.message}`);
  }

  async getUsers(): Promise<User[]> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getUsers();
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw new Error(`Unable to load users: ${error.message}`);
    if (!data) return [];

    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
      username: d.username,
      avatar: d.avatar,
      coverImage: d.cover_image,
      bio: d.bio,
      location: d.location,
      website: d.website,
      verified: d.verified,
      followersCount: d.followers_count || 0,
      followingCount: d.following_count || 0,
      postsCount: d.posts_count || 0,
      joinedDate: new Date(d.created_at).toLocaleDateString(),
      role: d.role || 'user',
      isBlocked: d.is_suspended,
      isPrivate: d.is_private,
    }));
  }

  async toggleUserSuspension(userId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.toggleUserSuspension(userId);
    }

    const { data: target, error: lookupError } = await supabase
      .from('profiles')
      .select('is_suspended, username')
      .eq('id', userId)
      .single();
    if (lookupError || !target) throw new Error(`Unable to load account: ${lookupError?.message || 'Account not found'}`);

    const newSuspended = !target.is_suspended;
    const { data: changed, error: updateError } = await supabase
      .from('profiles')
      .update({ is_suspended: newSuspended })
      .eq('id', userId)
      .select('id')
      .maybeSingle();
    if (updateError) throw new Error(`Unable to update account status: ${updateError.message}`);
    if (!changed) throw new Error('Account status was not changed. Check administrator permissions.');

    const { data: { user: adminUser } } = await supabase.auth.getUser();
    if (!adminUser) throw new Error('Authentication required');
    const { error: auditError } = await supabase.from('admin_audit_logs').insert({
      admin_id: adminUser.id,
      admin_name: adminUser.user_metadata?.name || 'Admin',
      action: newSuspended ? 'Suspended User' : 'Unsuspended User',
      target: `@${target.username}`,
      status: newSuspended ? 'danger' : 'success',
    });
    if (auditError) throw new Error(`Account status changed, but audit logging failed: ${auditError.message}`);

    return newSuspended;
  }

  async toggleUserVerification(userId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.toggleUserVerification(userId);
    }

    const { data: target, error: lookupError } = await supabase
      .from('profiles')
      .select('verified, username')
      .eq('id', userId)
      .single();
    if (lookupError || !target) throw new Error(`Unable to load account: ${lookupError?.message || 'Account not found'}`);

    const newVerified = !target.verified;
    const { data: changed, error: updateError } = await supabase
      .from('profiles')
      .update({ verified: newVerified })
      .eq('id', userId)
      .select('id')
      .maybeSingle();
    if (updateError) throw new Error(`Unable to update verification: ${updateError.message}`);
    if (!changed) throw new Error('Verification status was not changed. Check administrator permissions.');

    const { data: { user: adminUser } } = await supabase.auth.getUser();
    if (!adminUser) throw new Error('Authentication required');
    const { error: auditError } = await supabase.from('admin_audit_logs').insert({
      admin_id: adminUser.id,
      admin_name: adminUser.user_metadata?.name || 'Admin',
      action: newVerified ? 'Granted Verified Badge' : 'Revoked Verified Badge',
      target: `@${target.username}`,
      status: newVerified ? 'success' : 'warning',
    });
    if (auditError) throw new Error(`Verification changed, but audit logging failed: ${auditError.message}`);

    return newVerified;
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getAuditLogs();
    }

    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw new Error(`Unable to load audit history: ${error.message}`);
    if (!data) return [];

    return data.map((d: any) => ({
      id: d.id,
      adminName: d.admin_name,
      action: d.action,
      target: d.target,
      timestamp: new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: d.status || 'success',
    }));
  }

  async submitReport(
    itemType: 'post' | 'user' | 'comment' | 'community',
    itemId: string,
    itemSnippet: string,
    reason: string,
    details?: string
  ): Promise<Report> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.submitReport(itemType, itemId, itemSnippet, reason, details);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const { data, error } = await supabase
      .from('reports')
      .insert({
        reported_by: user.id,
        reported_item_type: itemType,
        reported_item_id: itemId,
        reported_item_snippet: itemSnippet,
        reason,
        details,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      reportedItemType: data.reported_item_type,
      reportedItemId: data.reported_item_id,
      reportedItemSnippet: data.reported_item_snippet,
      reportedByUser: {
        id: user.id,
        name: user.user_metadata?.name || 'User',
        username: user.user_metadata?.username || 'user',
        avatar: '',
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        joinedDate: '2024',
        role: 'user',
      },
      reason: data.reason,
      details: data.details,
      status: 'pending',
      createdAt: 'Just now',
    };
  }
}
