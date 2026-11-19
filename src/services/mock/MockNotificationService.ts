import { INotificationService } from '../interfaces/INotificationService';
import { NotificationItem } from '../../types';
import { MOCK_NOTIFICATIONS } from '../../constants/mockData';
import { storage } from './storage';

const STORAGE_KEY_NOTIFS = 'vortex_notifs_store';

export class MockNotificationService implements INotificationService {
  private getNotifsStore(): NotificationItem[] {
    return storage.get<NotificationItem[]>(STORAGE_KEY_NOTIFS, MOCK_NOTIFICATIONS);
  }

  private saveNotifsStore(notifs: NotificationItem[]): void {
    storage.set(STORAGE_KEY_NOTIFS, notifs);
  }

  async getNotifications(filter: 'all' | 'mentions' = 'all'): Promise<NotificationItem[]> {
    const list = this.getNotifsStore();
    if (filter === 'mentions') {
      return list.filter((n) => n.type === 'mention' || n.type === 'comment' || n.type === 'reply');
    }
    return list;
  }

  async markAsRead(notificationId: string): Promise<void> {
    const list = this.getNotifsStore();
    const target = list.find((n) => n.id === notificationId);
    if (target) {
      target.isRead = true;
      this.saveNotifsStore(list);
    }
  }

  async markAllAsRead(): Promise<void> {
    const list = this.getNotifsStore();
    list.forEach((n) => (n.isRead = true));
    this.saveNotifsStore(list);
  }

  async clearAll(): Promise<void> {
    this.saveNotifsStore([]);
  }

  async getUnreadCount(): Promise<number> {
    const list = this.getNotifsStore();
    return list.filter((n) => !n.isRead).length;
  }
  subscribeToNotifications(_onChange: () => void): () => void {
    return () => undefined;
  }
}
