import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { MobileTopNav } from './MobileTopNav';
import { MobileBottomNav } from './MobileBottomNav';
import { CreatePostModal } from '../feed/CreatePostModal';

interface AppLayoutProps {
  showRightSidebar?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ showRightSidebar = true }) => {
  const [createPostOpen, setCreatePostOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-bg text-fg flex flex-col antialiased">
      {/* Mobile Top Navigation */}
      <MobileTopNav />

      {/* Main Container */}
      <div className="flex-1 flex justify-center max-w-7xl mx-auto w-full">
        {/* Left Desktop Sidebar */}
        <LeftSidebar onOpenCreatePost={() => setCreatePostOpen(true)} />

        {/* Central Focus Content */}
        <main className="flex-1 min-w-0 max-w-2xl lg:max-w-3xl border-x border-border min-h-[100dvh] pb-20 md:pb-8">
          <Outlet />
        </main>

        {/* Right Desktop Sidebar */}
        {showRightSidebar && <RightSidebar />}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav onOpenCreatePost={() => setCreatePostOpen(true)} />

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
