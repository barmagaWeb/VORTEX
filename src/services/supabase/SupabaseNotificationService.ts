import { INotificationService } from '../interfaces/INotificationService';
import { NotificationItem, User } from '../../types';
import { supabase, isSupabaseConfigured } from './client';
import { MockNotificationService } from '../mock/MockNotificationService';

interface NotificationActorRow {
  id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  followers_count: number | null;
  following_count: number | null;
  posts_count: number | null;
  created_at: string | null;
  role: User['role'] | null;
}

interface NotificationDatabaseRow {
  id: string;
  type: NotificationItem['type'];
  actor_id: string;
  actor: NotificationActorRow | null;
  post_id: string | null;
  comment_id: string | null;
  community_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  post_snippet: string | null;
  created_at: string;
  is_read: boolean;
}

export class SupabaseNotificationService implements INotificationService {
  private fallbackMock = new MockNotificationService();

  async getNotifications(filter: 'all' | 'mentions' = 'all'): Promise<NotificationItem[]> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getNotifications(filter);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('notifications')
      .select(`
        *,
        actor:profiles!notifications_actor_id_fkey(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (filter === 'mentions') {
      query = query.in('type', ['mention', 'comment', 'reply']);
    }

    const { data, error } = await query.limit(50);
    if (error) throw new Error(`Failed to load notifications: ${error.message}`);
    if (!data) return [];

    const rows = data as unknown as NotificationDatabaseRow[];
    return rows.map((d) => {
      const actor: User = {
        id: d.actor?.id || d.actor_id,
        name: d.actor?.name || 'VORTEX Member',
        username: d.actor?.username || '',
        avatar: d.actor?.avatar || '',
        followersCount: d.actor?.followers_count || 0,
        followingCount: d.actor?.following_count || 0,
        postsCount: d.actor?.posts_count || 0,
        joinedDate: d.actor?.created_at ? new Date(d.actor.created_at).toLocaleDateString() : '',
        role: d.actor?.role || 'user',
      };

      return {
        id: d.id,
        type: d.type as NotificationItem['type'],
        actor,
        postId: d.post_id || undefined,
        commentId: d.comment_id || undefined,
        communityId: d.community_id || undefined,
        conversationId: d.conversation_id || undefined,
        messageId: d.message_id || undefined,
        postSnippet: d.post_snippet || undefined,
        createdAt: new Date(d.created_at).toLocaleString(),
        isRead: d.is_read,
      };
    });
  }

  async markAsRead(notificationId: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.markAsRead(notificationId);
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    if (error) throw new Error(`Failed to mark notification as read: ${error.message}`);
  }

  async markAllAsRead(): Promise<void> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.markAllAsRead();
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id);
    if (error) throw new Error(`Failed to mark notifications as read: ${error.message}`);
  }

  async clearAll(): Promise<void> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.clearAll();
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id);
    if (error) throw new Error(`Failed to clear notifications: ${error.message}`);
  }

  async getUnreadCount(): Promise<number> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getUnreadCount();
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) throw new Error(`Failed to load unread notification count: ${error.message}`);
    return count || 0;
  }
  subscribeToNotifications(onChange: () => void): () => void {
    if (!isSupabaseConfigured()) return this.fallbackMock.subscribeToNotifications(onChange);

    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active || !user) return;
      channel = supabase
        .channel(`vortex-notifications-${user.id}-${crypto.randomUUID()}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, (payload) => onChange((payload.new as { type?: NotificationItem['type'] }).type))
        .subscribe();
    }).catch((error: unknown) => console.error('VORTEX notification subscription failed', error));

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }
}
