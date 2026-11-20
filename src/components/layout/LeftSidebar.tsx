import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Compass,
  Bell,
  Mail,
  Users,
  Bookmark,
  User as UserIcon,
  Settings,
  ShieldCheck,
  PlusSquare,
  LogOut,
  Moon,
  Sun,
  Globe,
  Sparkles,
} from 'lucide-react';
import { Logo } from '../ui/Logo';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { isSupabaseConfigured } from '../../services';

interface LeftSidebarProps {
  onOpenCreatePost: () => void;
  unreadNotifsCount?: number;
  unreadMessagesCount?: number;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  onOpenCreatePost,
  unreadNotifsCount = 0,
  unreadMessagesCount = 0,
}) => {
  const { user, logout, switchRole } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { label: t('home'), path: '/feed', icon: Home },
    { label: t('explore'), path: '/explore', icon: Compass },
    {
      label: t('messages'),
      path: '/messages',
      icon: Mail,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined,
    },
    {
      label: t('notifications'),
      path: '/notifications',
      icon: Bell,
      badge: unreadNotifsCount > 0 ? unreadNotifsCount : undefined,
    },
    { label: t('communities'), path: '/communities', icon: Users },
    { label: t('bookmarks'), path: '/bookmarks', icon: Bookmark },
    {
      label: t('profile'),
      path: user ? `/profile/${user.username}` : '/profile',
      icon: UserIcon,
    },
    { label: t('settings'), path: '/settings', icon: Settings },
    {
      label: t('admin'),
      path: '/admin',
      icon: ShieldCheck,
      highlight: true,
    },
  ];

  return (
    <aside className="hidden md:flex flex-col justify-between w-64 lg:w-72 h-[100dvh] sticky top-0 px-4 py-5 border-e border-border bg-surface/85 backdrop-blur-xl z-20 shrink-0 select-none overflow-y-auto no-scrollbar">
      <div className="flex flex-col gap-5">
        {/* Brand Logo */}
        <div className="px-3 pt-1">
          <Logo size="md" showTagline />
        </div>

        {/* Navigation list */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                    isActive
                      ? 'bg-primary/15 text-primary-text border border-primary/30 shadow-sm font-bold'
                      : 'text-fg-muted hover:text-fg hover:bg-surface-hover'
                  } ${item.highlight ? 'text-primary-text' : ''}`
                }
              >
                <div className="flex items-center gap-3.5">
                  <Icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110 group-active:scale-95 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <Badge variant="count">{item.badge}</Badge>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Create Post Action Button */}
        <div className="px-1">
          <Button
            onClick={onOpenCreatePost}
            variant="primary"
            size="md"
            fullWidth
            leftIcon={<PlusSquare className="w-4 h-4" />}
            className="shadow-vortex-glow hover:shadow-violet-600/50 font-semibold"
          >
            {t('createPost')}
          </Button>
        </div>
      </div>

      {/* User profile snippet & Quick switches */}
      <div className="pt-4 mt-4 border-t border-border flex flex-col gap-2">
        {/* Quick controls: Language + Theme */}
        <div className="flex items-center justify-between px-1 text-xs text-fg-muted">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-fg-muted hover:text-fg transition-colors"
            title={t('toggleLanguage')}
            aria-label={t('toggleLanguage')}
          >
            <Globe className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold">{language === 'en' ? 'العربية' : 'English'}</span>
          </button>

          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-fg-muted hover:text-fg transition-colors"
            title={t('toggleTheme')}
            aria-label={t('toggleTheme')}
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-indigo-500" />
            )}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>

        {/* Demo role quick switcher */}
        {!isSupabaseConfigured() && (
          <div className="px-1">
            <button
              onClick={() => switchRole(user?.role === 'admin' ? 'user' : 'admin')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary-text hover:bg-primary/20 transition-colors"
              title={t('switchDemoPersona')}
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>{user?.role === 'admin' ? t('activeAsAdmin') : t('activeAsUser')}</span>
              </div>
              <span className="text-[10px] text-fg-muted underline">{t('switchPersona')}</span>
            </button>
          </div>
        )}

        {/* User Card */}
        {user && (
          <div className="flex items-center justify-between p-2 rounded-xl bg-surface border border-border hover:border-fg-subtle/40 transition-all shadow-sm">
            <NavLink
              to={`/profile/${user.username}`}
              className="flex items-center gap-2.5 min-w-0 group"
            >
              <Avatar src={user.avatar} alt={user.name} size="sm" isOnline />
              <div className="flex flex-col min-w-0 text-start">
                <span className="text-xs font-bold text-fg group-hover:text-primary-text transition-colors truncate">
                  <bdi>{user.name}</bdi>
                </span>
                <span className="text-[11px] text-fg-subtle truncate" dir="ltr">
                  @{user.username}
                </span>
              </div>
            </NavLink>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-fg-muted hover:text-danger hover:bg-danger/10 transition-colors"
              title={t('logout')}
              aria-label={t('logout')}
            >
              <LogOut className="w-4 h-4 rtl:-scale-x-100" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
