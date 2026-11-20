import { NotificationItem } from '../../types';

export interface INotificationService {
  /**
   * Fetches user notifications.
   * Future Supabase hook: supabase.from('notifications').select('*').order('created_at', { ascending: false })
   */
  getNotifications(filter?: 'all' | 'mentions'): Promise<NotificationItem[]>;

  /**
   * Marks a specific notification as read.
   */
  markAsRead(notificationId: string): Promise<void>;

  /**
   * Marks all notifications as read.
   */
  markAllAsRead(): Promise<void>;

  /**
   * Clears all notifications.
   */
  clearAll(): Promise<void>;

  /**
   * Returns count of unread notifications.
   */
  getUnreadCount(): Promise<number>;
  subscribeToNotifications(onChange: (type?: NotificationItem['type']) => void): () => void;
}
