import React, { useEffect, useState } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { authService } from '../services';
import { LandingPage } from '../pages/LandingPage';
import { HomePage } from '../pages/feed/HomePage';
import { ExplorePage } from '../pages/explore/ExplorePage';
import { ProfilePage } from '../pages/profile/ProfilePage';
import { MessagesPage } from '../pages/messaging/MessagesPage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';
import { CommunitiesPage } from '../pages/communities/CommunitiesPage';
import { CommunityDetailPage } from '../pages/communities/CommunityDetailPage';
import { BookmarksPage } from '../pages/bookmarks/BookmarksPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { AdminPage } from '../pages/admin/AdminPage';
import { HashtagPage } from '../pages/hashtag/HashtagPage';
import { NotFoundPage } from '../pages/NotFoundPage';

import { SignInPage } from '../pages/auth/SignInPage';
import { SignUpPage } from '../pages/auth/SignUpPage';
import { ForgotPasswordPage, ResetPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { VerifyEmailPage } from '../pages/auth/VerifyEmailPage';

const RouteLoading: React.FC = () => {
  const { t } = useLanguage();
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-bg text-fg-muted">
      <div
        role="status"
        aria-label={t('loading')}
        className="h-8 w-8 animate-spin motion-reduce:animate-none rounded-full border-2 border-primary border-t-transparent"
      />
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <RouteLoading />;
  if (!user) return <Navigate to="/auth/signin" replace />;
  if (!isAuthenticated) return <Navigate to="/auth/verify" replace />;
  return <>{children}</>;
};

const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <RouteLoading />;
  if (user && user.emailVerified === false) return <Navigate to="/auth/verify" replace />;
  if (isAuthenticated) return <Navigate to="/feed" replace />;
  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    let active = true;

    const verifyAdminRole = async () => {
      if (isLoading || !isAuthenticated || !user) {
        setIsChecking(false);
        setIsAuthorized(false);
        return;
      }

      setIsChecking(true);
      try {
        const allowed = await authService.hasAdminRole();
        if (active) setIsAuthorized(allowed);
      } catch {
        if (active) setIsAuthorized(false);
      } finally {
        if (active) setIsChecking(false);
      }
    };

    void verifyAdminRole();
    return () => {
      active = false;
    };
  }, [isAuthenticated, isLoading, user?.id]);

  if (isLoading) return <RouteLoading />;
  if (!user) return <Navigate to="/auth/signin" replace />;
  if (!isAuthenticated) return <Navigate to="/auth/verify" replace />;
  if (isChecking) return <RouteLoading />;
  if (!isAuthorized) return <Navigate to="/feed" replace />;
  return <>{children}</>;
};

const VerificationRoute: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <RouteLoading />;
  if (isAuthenticated) return <Navigate to="/feed" replace />;
  if (user?.emailVerified) return <Navigate to="/feed" replace />;
  return <VerifyEmailPage />;
};

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },

  {
    path: '/auth/signin',
    element: (
      <GuestRoute>
        <SignInPage />
      </GuestRoute>
    ),
  },
  {
    path: '/auth/signup',
    element: (
      <GuestRoute>
        <SignUpPage />
      </GuestRoute>
    ),
  },
  {
    path: '/auth/forgot',
    element: (
      <GuestRoute>
        <ForgotPasswordPage />
      </GuestRoute>
    ),
  },
  {
    path: '/auth/verify',
    element: <VerificationRoute />,
  },
  // A valid password-recovery callback must remain accessible to its authenticated user.
  {
    path: '/auth/reset',
    element: <ResetPasswordPage />,
  },

  {
    element: (
      <ProtectedRoute>
        <AppLayout showRightSidebar={true} />
      </ProtectedRoute>
    ),
    children: [
      { path: '/feed', element: <HomePage /> },
      { path: '/explore', element: <ExplorePage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/profile/:username', element: <ProfilePage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      { path: '/communities', element: <CommunitiesPage /> },
      { path: '/communities/:slug', element: <CommunityDetailPage /> },
      { path: '/bookmarks', element: <BookmarksPage /> },
      { path: '/settings', element: <SettingsPage /> },
      {
        path: '/admin',
        element: (
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        ),
      },
      { path: '/hashtag/:tag', element: <HashtagPage /> },
    ],
  },

  {
    element: (
      <ProtectedRoute>
        <AppLayout showRightSidebar={false} wideContent />
      </ProtectedRoute>
    ),
    children: [
      { path: '/messages', element: <MessagesPage /> },
    ],
  },

  {
    path: '*',
    element: <NotFoundPage />,
  },
], { basename: import.meta.env.BASE_URL });
