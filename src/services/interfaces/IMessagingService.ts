import { Conversation, Message, User } from '../../types';

export interface ConversationMember {
  user: User;
  role: 'admin' | 'member';
}

export interface IMessagingService {
  /**
   * Fetches all active conversations.
   * Future Supabase hook: supabase.from('conversations').select('*, participants(*), last_message(*)')
   */
  getConversations(): Promise<Conversation[]>;

  /**
   * Fetches messages for a given conversation.
   * Future Supabase hook: supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at')
   */
  getMessages(conversationId: string): Promise<Message[]>;

  /**
   * Sends a message.
   * Future Supabase hook: supabase.from('messages').insert(msgData)
   * Notification fan-out is performed by the database after a successful insert.
   */
  sendMessage(conversationId: string, content: string, attachments?: string[]): Promise<Message>;

  /**
   * Marks a conversation's messages as read.
   */
  markConversationAsRead(conversationId: string): Promise<void>;

  /**
   * Starts or retrieves an existing direct conversation with a user.
   */
  getOrCreateConversation(targetUserId: string): Promise<Conversation>;

  createGroupConversation(name: string, memberIds: string[]): Promise<Conversation>;
  getConversationMembers(conversationId: string): Promise<ConversationMember[]>;
  addGroupMember(conversationId: string, memberId: string): Promise<void>;
  removeGroupMember(conversationId: string, memberId: string): Promise<void>;
  leaveGroup(conversationId: string): Promise<void>;
  renameGroup(conversationId: string, name: string): Promise<void>;

  /** Subscribe to inserts for one conversation. Always return an unsubscribe function. */
  subscribeToMessages(conversationId: string, onMessage: (message: Message) => void): () => void;
}
