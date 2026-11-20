import { ConversationMember, IMessagingService } from '../interfaces/IMessagingService';
import { Conversation, Message, User } from '../../types';
import { supabase, isSupabaseConfigured } from './client';
import { MockMessagingService } from '../mock/MockMessagingService';
import { resolveStorageUrls } from './storage';

interface MessageRow {
  id: string;
  sender_id: string;
  conversation_id: string;
  content: string;
  created_at: string;
  attachments?: string[] | null;
  message_reads?: Array<{ user_id: string }>;
}

interface ConversationSummaryRow {
  conversation_id: string;
  is_group: boolean;
  group_name: string | null;
  group_avatar: string | null;
  owner_id: string | null;
  other_user_id: string | null;
  other_name: string | null;
  other_username: string | null;
  other_avatar: string | null;
  other_followers_count: number | null;
  other_following_count: number | null;
  other_posts_count: number | null;
  other_joined_at: string | null;
  other_role: User['role'] | null;
  last_message_id: string | null;
  last_message_sender_id: string | null;
  last_message_content: string | null;
  last_message_created_at: string | null;
  last_message_attachments: string[] | null;
  unread_count: number | string;
}

const formatTime = (value: string): string => new Date(value).toLocaleTimeString([], {
  hour: '2-digit',
  minute: '2-digit',
});

export class SupabaseMessagingService implements IMessagingService {
  private fallbackMock = new MockMessagingService();

  private async mapMessage(row: MessageRow, currentUserId?: string): Promise<Message> {
    const attachments = Array.isArray(row.attachments) && row.attachments.length
      ? await resolveStorageUrls('attachments', row.attachments)
      : [];
    const readByOther = (row.message_reads || []).some((receipt) => receipt.user_id !== row.sender_id);
    return {
      id: row.id,
      senderId: row.sender_id,
      conversationId: row.conversation_id,
      content: row.content,
      attachments,
      createdAt: formatTime(row.created_at),
      isRead: row.sender_id === currentUserId || readByOther,
    };
  }

  async getConversations(): Promise<Conversation[]> {
    if (!isSupabaseConfigured()) return this.fallbackMock.getConversations();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) return [];

    // The database function returns one summary per conversation, instead of
    // downloading every message for every conversation just to find the last one.
    const { data, error } = await supabase.rpc('vortex_get_conversation_summaries');
    if (error) throw new Error(`Failed to load conversations: ${error.message}`);
    const rows = (data || []) as unknown as ConversationSummaryRow[];

    return Promise.all(rows.map(async (row): Promise<Conversation> => {
      const participant: User = {
        id: row.other_user_id || row.conversation_id,
        name: row.is_group ? (row.group_name || 'Group conversation') : (row.other_name || 'VORTEX Member'),
        username: row.other_username || '',
        avatar: row.is_group ? (row.group_avatar || '') : (row.other_avatar || ''),
        followersCount: Number(row.other_followers_count || 0),
        followingCount: Number(row.other_following_count || 0),
        postsCount: Number(row.other_posts_count || 0),
        joinedDate: row.other_joined_at ? new Date(row.other_joined_at).toLocaleDateString() : '',
        role: row.other_role || 'user',
      };

      const lastMessage: Message = row.last_message_id && row.last_message_created_at
        ? await this.mapMessage({
          id: row.last_message_id,
          sender_id: row.last_message_sender_id || '',
          conversation_id: row.conversation_id,
          content: row.last_message_content || '',
          created_at: row.last_message_created_at,
          attachments: row.last_message_attachments || [],
        }, user.id)
        : {
          id: '', senderId: '', conversationId: row.conversation_id,
          content: '', createdAt: '', isRead: true,
        };

      return {
        id: row.conversation_id,
        participant,
        lastMessage,
        unreadCount: Number(row.unread_count || 0),
        isOnline: false,
        isGroup: row.is_group,
        groupName: row.group_name || undefined,
        ownerId: row.owner_id || undefined,
      };
    }));
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    if (!isSupabaseConfigured()) return this.fallbackMock.getMessages(conversationId);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) throw new Error('Authentication required');

    // Fetch the latest page efficiently, then restore chronological order for display.
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, conversation_id, content, created_at, attachments, message_reads(user_id)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw new Error(`Failed to load messages: ${error.message}`);
    const rows = (data || []) as unknown as MessageRow[];
    const messages = await Promise.all(rows.map((message) => this.mapMessage(message, user.id)));
    return messages.reverse();
  }

  async sendMessage(conversationId: string, content: string, attachments: string[] = []): Promise<Message> {
    if (!isSupabaseConfigured()) return this.fallbackMock.sendMessage(conversationId, content, attachments);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) throw new Error('Authentication required');

    const cleanContent = content.trim();
    if (!cleanContent && attachments.length === 0) throw new Error('A message or image attachment is required.');
    if (cleanContent.length > 5000) throw new Error('Messages cannot exceed 5,000 characters.');
    if (attachments.length > 4) throw new Error('A message can contain up to four images.');

    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: user.id, content: cleanContent, attachments })
      .select('id, sender_id, conversation_id, content, created_at, attachments')
      .single();

    if (error) throw new Error(`Failed to send message: ${error.message}`);
    return this.mapMessage(data as MessageRow, user.id);
  }

  async markConversationAsRead(conversationId: string): Promise<void> {
    if (!isSupabaseConfigured()) return this.fallbackMock.markConversationAsRead(conversationId);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) return;
    const { error } = await supabase.rpc('vortex_mark_conversation_read', {
      p_conversation_id: conversationId,
    });
    if (error) throw new Error(`Failed to mark conversation as read: ${error.message}`);
  }

  async getOrCreateConversation(targetUserId: string): Promise<Conversation> {
    if (!isSupabaseConfigured()) return this.fallbackMock.getOrCreateConversation(targetUserId);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) throw new Error('Authentication required');
    if (targetUserId === user.id) throw new Error('You cannot start a conversation with yourself.');

    const { data: conversationId, error } = await supabase.rpc('vortex_get_or_create_direct_conversation', {
      p_target_user_id: targetUserId,
    });
    if (error || !conversationId) throw new Error(error?.message || 'Unable to create the conversation.');
    const conversation = (await this.getConversations()).find((item) => item.id === conversationId);
    if (!conversation) throw new Error('Conversation created but could not be loaded. Check conversation membership policies.');
    return conversation;
  }

  async createGroupConversation(name: string, memberIds: string[]): Promise<Conversation> {
    if (!isSupabaseConfigured()) throw new Error('Group messaging requires a configured Supabase project.');
    const cleanName = name.trim();
    if (!cleanName || cleanName.length > 80) throw new Error('Group name must contain 1–80 characters.');
    const { data: conversationId, error } = await supabase.rpc('vortex_create_group_conversation', {
      p_group_name: cleanName,
      p_member_ids: [...new Set(memberIds)],
    });
    if (error || !conversationId) throw new Error(error?.message || 'Unable to create the group.');
    const conversation = (await this.getConversations()).find((item) => item.id === conversationId);
    if (!conversation) throw new Error('Group created but could not be loaded.');
    return conversation;
  }

  async getConversationMembers(conversationId: string): Promise<ConversationMember[]> {
    if (!isSupabaseConfigured()) throw new Error('Group management requires Supabase.');
    const { data, error } = await supabase
      .from('conversation_members')
      .select('user_id, role, profiles(id, name, username, avatar, followers_count, following_count, posts_count, created_at, role)')
      .eq('conversation_id', conversationId)
      .order('joined_at', { ascending: true });
    if (error) throw new Error(`Failed to load group members: ${error.message}`);

    return (data || []).flatMap((value) => {
      const row = value as unknown as {
        user_id: string;
        role: string | null;
        profiles: {
          id: string; name: string; username: string; avatar: string | null;
          followers_count: number | null; following_count: number | null; posts_count: number | null;
          created_at: string | null; role: User['role'] | null;
        } | null;
      };
      if (!row.profiles) return [];
      const profile = row.profiles;
      const user: User = {
        id: profile.id,
        name: profile.name,
        username: profile.username,
        avatar: profile.avatar || '',
        followersCount: profile.followers_count || 0,
        followingCount: profile.following_count || 0,
        postsCount: profile.posts_count || 0,
        joinedDate: profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '',
        role: profile.role || 'user',
      };
      return [{ user, role: row.role === 'admin' ? 'admin' : 'member' }];
    });
  }

  async addGroupMember(conversationId: string, memberId: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Group management requires Supabase.');
    const { error } = await supabase.rpc('vortex_add_group_member', { p_conversation_id: conversationId, p_member_id: memberId });
    if (error) throw new Error(error.message);
  }

  async removeGroupMember(conversationId: string, memberId: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Group management requires Supabase.');
    const { error } = await supabase.rpc('vortex_remove_group_member', { p_conversation_id: conversationId, p_member_id: memberId });
    if (error) throw new Error(error.message);
  }

  async leaveGroup(conversationId: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Group management requires Supabase.');
    const { error } = await supabase.rpc('vortex_leave_group', { p_conversation_id: conversationId });
    if (error) throw new Error(error.message);
  }

  async renameGroup(conversationId: string, name: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Group management requires Supabase.');
    const cleanName = name.trim();
    if (!cleanName || cleanName.length > 80) throw new Error('Group name must contain 1–80 characters.');
    const { error } = await supabase.rpc('vortex_rename_group', { p_conversation_id: conversationId, p_group_name: cleanName });
    if (error) throw new Error(error.message);
  }

  subscribeToMessages(conversationId: string, onMessage: (message: Message) => void): () => void {
    if (!isSupabaseConfigured()) return this.fallbackMock.subscribeToMessages(conversationId, onMessage);
    const channel = supabase
      .channel(`vortex-messages-${conversationId}-${crypto.randomUUID()}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const row = payload.new as MessageRow;
        void supabase.auth.getSession()
          .then(({ data: { session } }) => this.mapMessage(row, session?.user.id))
          .then(onMessage)
          .catch((error: unknown) => console.error('VORTEX realtime message mapping failed', error));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }
}
