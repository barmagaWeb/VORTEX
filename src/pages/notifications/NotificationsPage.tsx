import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  Repeat2,
  Users,
  CheckCheck,
  Trash2,
  Mail,
  CornerDownRight,
} from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { Tabs } from '../../components/ui/Tabs';
import { EmptyState } from '../../components/ui/EmptyState';
import { notificationService } from '../../services';
import { NotificationItem } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';

export const NotificationsPage: React.FC = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'all' | 'mentions'>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const data = await notificationService.getNotifications(activeTab);
      setNotifications(data);
      setLoadError(null);
    } catch (error) {
      setNotifications([]);
      setLoadError(error instanceof Error ? error.message : t('notificationsLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchNotifs();
    const unsubscribe = notificationService.subscribeToNotifications(() => {
      void fetchNotifs();
    });
    return unsubscribe;
  }, [activeTab]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === id ? { ...notification, isRead: true } : notification
        )
      );
    } catch {
      showToast(t('notificationUpdateFailed'));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));
      showToast(t('allNotificationsRead'));
    } catch {
      showToast(t('notificationsUpdateFailed'));
    }
  };

  const handleClearAll = async () => {
    try {
      await notificationService.clearAll();
      setNotifications([]);
      showToast(t('notificationsCleared'));
    } catch {
      showToast(t('notificationsClearFailed'));
    }
  };

  const tabs = [
    { id: 'all', label: t('all') },
    { id: 'mentions', label: t('mentions') },
  ];

  const getIconForType = (type: NotificationItem['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-rose-500 fill-current" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-blue-500" />;
      case 'reply':
        return <CornerDownRight className="w-4 h-4 text-primary rtl:rotate-180" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-primary" />;
      case 'repost':
        return <Repeat2 className="w-4 h-4 text-emerald-500" />;
      case 'community':
        return <Users className="w-4 h-4 text-amber-500" />;
      case 'message':
        return <Mail className="w-4 h-4 text-primary" />;
      case 'mention':
        return <MessageCircle className="w-4 h-4 text-primary" />;
      default:
        return <Bell className="w-4 h-4 text-fg-subtle" />;
    }
  };

  const getDescriptionForType = (type: NotificationItem['type']) => {
    switch (type) {
      case 'like': return t('notificationLike');
      case 'comment': return t('notificationComment');
      case 'reply': return t('notificationReply');
      case 'follow': return t('notificationFollow');
      case 'repost': return t('notificationRepost');
      case 'message': return t('notificationMessage');
      case 'community': return t('notificationCommunity');
      case 'mention': return t('notificationMention');
      default: return '';
    }
  };

  const getNotificationHref = (notification: NotificationItem) => {
    if (notification.type === 'message') return '/messages';
    if (notification.type === 'community') return '/communities';
    if (notification.postId) return '/feed';
    return `/profile/${notification.actor.username}`;
  };

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <div className="sticky top-0 z-20 bg-surface/85 backdrop-blur-md border-b border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-black text-fg">{t('notifications')}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleMarkAllRead()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-text hover:bg-surface-hover transition-colors min-h-[36px]"
            >
              <CheckCheck className="w-4 h-4" />
              <span>{t('markAllRead')}</span>
            </button>
            <button
              onClick={() => void handleClearAll()}
              className="p-1.5 rounded-lg text-fg-muted hover:text-danger hover:bg-surface-hover transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
              title={t('clearAll')}
              aria-label={t('clearAll')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as 'all' | 'mentions')}
        />
      </div>

      <div className="p-4 sm:p-6 space-y-3">
        {loadError && (
          <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger-text">
            {t('notificationsLoadFailed')}
          </div>
        )}
        {loading ? (
          <div className="p-8 text-center text-fg-subtle text-xs">{t('loadingNotifications')}</div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="w-6 h-6" />}
            title={t('noNotifications')}
            description={t('notificationDescription')}
          />
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => void handleMarkAsRead(notification.id)}
                className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 cursor-pointer shadow-sm ${
                  notification.isRead
                    ? 'bg-surface border-border opacity-90'
                    : 'bg-primary/10 border-primary/30 shadow-card'
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar src={notification.actor.avatar} alt={notification.actor.name} size="md" />
                  <span className="absolute -bottom-1 -end-1 p-1 rounded-full bg-surface border border-border shadow-sm">
                    {getIconForType(notification.type)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm text-fg">
                    <Link
                      to={`/profile/${notification.actor.username}`}
                      className="font-bold text-fg hover:text-primary-text hover:underline me-1 transition-colors"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <bdi>{notification.actor.name}</bdi>
                    </Link>
                    <span>{getDescriptionForType(notification.type)}</span>
                  </div>

                  {notification.postSnippet && (
                    <Link
                      to={getNotificationHref(notification)}
                      onClick={(event) => event.stopPropagation()}
                      className="block text-xs text-fg-muted mt-1 line-clamp-1 italic bg-surface-elevated px-2.5 py-1 rounded-lg border border-border hover:text-fg transition-colors"
                      dir="auto"
                    >
                      “{notification.postSnippet}”
                    </Link>
                  )}

                  <Link
                    to={getNotificationHref(notification)}
                    onClick={(event) => event.stopPropagation()}
                    className="text-[11px] text-fg-subtle mt-1.5 inline-block hover:text-primary-text transition-colors"
                  >
                    {notification.createdAt}
                  </Link>
                </div>

                {!notification.isRead && (
                  <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-2" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
