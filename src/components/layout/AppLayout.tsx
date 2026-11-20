import React, { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { MobileTopNav } from './MobileTopNav';
import { MobileBottomNav } from './MobileBottomNav';
import { CreatePostModal } from '../feed/CreatePostModal';
import { messagingService, notificationService } from '../../services';
import { useAuth } from '../../context/AuthContext';

interface AppLayoutProps {
  showRightSidebar?: boolean;
  wideContent?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ showRightSidebar = true, wideContent = false }) => {
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const { user } = useAuth();
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  const refreshUnreadCounts = useCallback(async () => {
    if (!user) {
      setUnreadNotifsCount(0);
      setUnreadMessagesCount(0);
      return;
    }
    try {
      const [notificationCount, conversations] = await Promise.all([
        notificationService.getUnreadCount(),
        messagingService.getConversations(),
      ]);
      setUnreadNotifsCount(notificationCount);
      setUnreadMessagesCount(conversations.reduce((total, conversation) => total + conversation.unreadCount, 0));
    } catch (error) {
      console.error('Unable to refresh VORTEX unread counters', error);
    }
  }, [user?.id]);

  useEffect(() => {
    void refreshUnreadCounts();
    const unsubscribeNotifications = notificationService.subscribeToNotifications(() => {
      void notificationService.getUnreadCount()
        .then(setUnreadNotifsCount)
        .catch((error: unknown) => console.error('Unable to refresh notification count', error));
    });
    const refreshMessageCount = () => {
      void messagingService.getConversations()
        .then((conversations) => setUnreadMessagesCount(
          conversations.reduce((total, conversation) => total + conversation.unreadCount, 0)
        ))
        .catch((error: unknown) => console.error('Unable to refresh message count', error));
    };
    const unsubscribeInbox = messagingService.subscribeToInboxMessages((message) => {
      if (message.senderId !== user?.id) refreshMessageCount();
    });
    window.addEventListener('vortex:messages_read', refreshMessageCount);
    return () => {
      unsubscribeNotifications();
      unsubscribeInbox();
      window.removeEventListener('vortex:messages_read', refreshMessageCount);
    };
  }, [refreshUnreadCounts, user?.id]);

  return (
    <div className="min-h-[100dvh] bg-bg text-fg flex flex-col antialiased">
      {/* Mobile Top Navigation */}
      <MobileTopNav unreadNotifsCount={unreadNotifsCount} />

      {/* Main Container */}
      <div className="flex-1 flex justify-center max-w-7xl mx-auto w-full">
        {/* Left Desktop Sidebar */}
        <LeftSidebar onOpenCreatePost={() => setCreatePostOpen(true)} unreadNotifsCount={unreadNotifsCount} unreadMessagesCount={unreadMessagesCount} />

        {/* Central Focus Content */}
        <main className={`flex-1 min-w-0 w-full ${wideContent ? "max-w-none" : "max-w-2xl lg:max-w-3xl"} overflow-x-clip border-x border-border min-h-[100dvh] pb-20 md:pb-8`}>
          <Outlet />
        </main>

        {/* Right Desktop Sidebar */}
        {showRightSidebar && <RightSidebar />}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav onOpenCreatePost={() => setCreatePostOpen(true)} unreadNotifsCount={unreadNotifsCount} />

      {/* Global Create Post Modal */}
      <CreatePostModal
        isOpen={createPostOpen}
        onClose={() => setCreatePostOpen(false)}
        onPostCreated={() => {
          window.dispatchEvent(new CustomEvent('vortex:post_created'));
        }}
      />
    </div>
  );
};
