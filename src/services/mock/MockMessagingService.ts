import { IMessagingService } from '../interfaces/IMessagingService';
import { Conversation, Message } from '../../types';
import { MOCK_CONVERSATIONS, CURRENT_USER, MOCK_USERS } from '../../constants/mockData';
import { storage } from './storage';

const STORAGE_KEY_CONVS = 'vortex_convs_store';
const STORAGE_KEY_MESSAGES = 'vortex_messages_store';

const INITIAL_MESSAGES: Record<string, Message[]> = {
  conv_sara: [
    {
      id: 'msg_sara_1',
      senderId: 'usr_sara',
      receiverId: 'usr_me',
      conversationId: 'conv_sara',
      content: 'مرحبا! كيف حالك؟ أردت مشاركتك النموذج الأولي للتصميم الجديد.',
      createdAt: '10:24 AM',
      isRead: true,
    },
    {
      id: 'msg_sara_2',
      senderId: 'usr_me',
      receiverId: 'usr_sara',
      conversationId: 'conv_sara',
      content: 'بخير، شكراً 😊 التصميم الجديد للواجهة رائع جداً، خاصة الألوان وتناسق الخطوط.',
      createdAt: '10:26 AM',
      isRead: true,
    },
    {
      id: 'msg_sara_3',
      senderId: 'usr_sara',
      receiverId: 'usr_me',
      conversationId: 'conv_sara',
      content: 'سعيد بسماع ذلك! سنقوم بتطوير واجهة الإشعارات والمحادثات غداً بإذن الله.',
      createdAt: '10:30 AM',
      isRead: true,
    }
  ],
  conv_mohamed: [
    {
      id: 'msg_moh_1',
      senderId: 'usr_mohamed',
      receiverId: 'usr_me',
      conversationId: 'conv_mohamed',
      content: 'Hello Ahmed! Did you see the new benchmarks on WebGPU client inference?',
      createdAt: 'Yesterday',
      isRead: true,
    },
    {
      id: 'msg_moh_2',
      senderId: 'usr_mohamed',
      receiverId: 'usr_me',
      conversationId: 'conv_mohamed',
      content: 'هل اطلعت على تجربة تشغيل WebGPU الأخيرة؟ النتائج مذهلة.',
      createdAt: '5m ago',
      isRead: false,
    }
  ],
  conv_group_tech: [
    {
      id: 'msg_grp_1',
      senderId: 'usr_sara',
      conversationId: 'conv_group_tech',
      content: 'Layla: We are hosting the live demo tomorrow at 6 PM GMT!',
      createdAt: '10m ago',
      isRead: true,
    }
  ],
  conv_layla: [
    {
      id: 'msg_lay_1',
      senderId: 'usr_layla',
      receiverId: 'usr_me',
      conversationId: 'conv_layla',
      content: 'سأرسل لك الألبوم عالي الدقة قريباً 📷 المناظر كانت خيالية في أعالي الجبال.',
      createdAt: '1h ago',
      isRead: true,
    }
  ]
};

export class MockMessagingService implements IMessagingService {
  private getConvsStore(): Conversation[] {
    return storage.get<Conversation[]>(STORAGE_KEY_CONVS, MOCK_CONVERSATIONS);
  }

  private saveConvsStore(convs: Conversation[]): void {
    storage.set(STORAGE_KEY_CONVS, convs);
  }

  private getMessagesStore(): Record<string, Message[]> {
    return storage.get<Record<string, Message[]>>(STORAGE_KEY_MESSAGES, INITIAL_MESSAGES);
  }

  private saveMessagesStore(messages: Record<string, Message[]>): void {
    storage.set(STORAGE_KEY_MESSAGES, messages);
  }

  async getTotalUnreadCount(): Promise<number> {
    const conversations = await this.getConversations();
    return conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
  }

  async getConversations(): Promise<Conversation[]> {
    return this.getConvsStore();
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const store = this.getMessagesStore();
    return store[conversationId] || [];
  }

  async sendMessage(conversationId: string, content: string, attachments?: string[]): Promise<Message> {
    const store = this.getMessagesStore();
    const convMessages = store[conversationId] || [];

    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      senderId: 'usr_me',
      conversationId,
      content,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: true,
      attachments,
    };

    convMessages.push(newMsg);
    store[conversationId] = convMessages;
    this.saveMessagesStore(store);

    // Update conversation last message
    const convs = this.getConvsStore();
    const conv = convs.find((c) => c.id === conversationId);
    if (conv) {
      conv.lastMessage = newMsg;
      this.saveConvsStore(convs);
    }

    // Trigger simulated reply after a delay if it's a 1-on-1 chat
    if (conv && !conv.isGroup) {
      setTimeout(() => {
        this.simulateAutoReply(conversationId, conv.participant.name);
      }, 1800);
    }

    return newMsg;
  }

  private simulateAutoReply(conversationId: string, participantName: string) {
    const store = this.getMessagesStore();
    const convMessages = store[conversationId] || [];

    const replyReplies = [
      `أشكرك على رسالتك! سأقوم بمراجعة التفاصيل ومتابعتها معك الآن. ✨`,
      `Awesome thoughts! Let's build this together on VORTEX. 🚀`,
      `تم استلام الفكرة! تبدو واعدة ومميزة للغاية.`,
      `Great idea! Let me coordinate with the team and get back to you shortly.`,
    ];
    const randomReply = replyReplies[Math.floor(Math.random() * replyReplies.length)];

    const convs = this.getConvsStore();
    const conv = convs.find((c) => c.id === conversationId);

    const autoMsg: Message = {
      id: `msg_auto_${Date.now()}`,
      senderId: conv ? conv.participant.id : 'usr_reply',
      conversationId,
      content: `${participantName}: ${randomReply}`,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: false,
    };

    convMessages.push(autoMsg);
    store[conversationId] = convMessages;
    this.saveMessagesStore(store);

    if (conv) {
      conv.lastMessage = autoMsg;
      conv.unreadCount = (conv.unreadCount || 0) + 1;
      this.saveConvsStore(convs);
    }
  }

  async markConversationAsRead(conversationId: string): Promise<void> {
    const convs = this.getConvsStore();
    const conv = convs.find((c) => c.id === conversationId);
    if (conv) {
      conv.unreadCount = 0;
      this.saveConvsStore(convs);
    }
    const store = this.getMessagesStore();
    if (store[conversationId]) {
      store[conversationId].forEach((m) => (m.isRead = true));
      this.saveMessagesStore(store);
    }
  }

  subscribeToInboxMessages(_onMessage: (message: Message) => void): () => void {
    return () => undefined;
  }

  subscribeToMessages(_conversationId: string, _onMessage: (message: Message) => void): () => void {
    return () => undefined;
  }

  async createGroupConversation(_name: string, _memberIds: string[]): Promise<Conversation> {
    throw new Error('Group creation is available only when Supabase is configured.');
  }

  async getConversationMembers(_conversationId: string): Promise<never[]> {
    throw new Error('Group management is available only when Supabase is configured.');
  }

  async addGroupMember(_conversationId: string, _memberId: string): Promise<void> {
    throw new Error('Group management is available only when Supabase is configured.');
  }

  async removeGroupMember(_conversationId: string, _memberId: string): Promise<void> {
    throw new Error('Group management is available only when Supabase is configured.');
  }

  async leaveGroup(_conversationId: string): Promise<void> {
    throw new Error('Group management is available only when Supabase is configured.');
  }

  async renameGroup(_conversationId: string, _name: string): Promise<void> {
    throw new Error('Group management is available only when Supabase is configured.');
  }

  async getOrCreateConversation(targetUserId: string): Promise<Conversation> {
    const convs = this.getConvsStore();
    const existing = convs.find((c) => c.participant.id === targetUserId);
    if (existing) return existing;

    const targetUser = MOCK_USERS.find((u) => u.id === targetUserId) || {
      ...CURRENT_USER,
      id: targetUserId,
      name: 'Vortex Member',
      username: `user_${targetUserId}`,
    };

    const newConv: Conversation = {
      id: `conv_${Date.now()}`,
      participant: targetUser,
      lastMessage: {
        id: `msg_init_${Date.now()}`,
        senderId: targetUserId,
        conversationId: `conv_${Date.now()}`,
        content: 'Started a new conversation',
        createdAt: 'Just now',
        isRead: true,
      },
      unreadCount: 0,
      isOnline: true,
    };

    convs.unshift(newConv);
    this.saveConvsStore(convs);
    return newConv;
  }
}
