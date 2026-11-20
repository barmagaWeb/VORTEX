import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Bell, Menu, X, Sun, Moon, Globe, ShieldCheck, LogOut } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { isSupabaseConfigured } from '../../services';

interface MobileTopNavProps {
  unreadNotifsCount?: number;
}

export const MobileTopNav: React.FC<MobileTopNavProps> = ({ unreadNotifsCount = 0 }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, isAdmin, logout, switchRole } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <>
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-surface/85 backdrop-blur-md border-b border-border select-none">
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label={t('openNavigation')}
        >
          <Menu className="w-5 h-5" />
        </button>

        <Logo size="sm" />

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/explore')}
            className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
            aria-label={t('search')}
          >
            <Search className="w-5 h-5" />
          </button>
          <Link
            to="/notifications"
            className="relative p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
            aria-label={t('notifications')}
          >
            <Bell className="w-5 h-5" />
            {unreadNotifsCount > 0 && (
              <span className="absolute -top-0.5 -end-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] leading-4 text-center font-bold ring-2 ring-surface">
                {unreadNotifsCount > 99 ? '99+' : unreadNotifsCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Mobile slide-over drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-overlay/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-4/5 max-w-xs bg-surface-elevated border-e border-border h-full p-5 flex flex-col justify-between z-10 shadow-2xl overflow-y-auto">
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <Logo size="sm" showTagline />
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 text-fg-muted hover:text-fg min-w-[36px] min-h-[36px] flex items-center justify-center"
                  aria-label={t('closeNavigation')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation links */}
              <nav className="flex flex-col gap-1.5 pt-2">
                <Link
                  to="/feed"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-2.5 rounded-xl font-medium text-fg hover:bg-surface-hover min-h-[44px] flex items-center"
                >
                  {t('home')}
                </Link>
                <Link
                  to="/explore"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-2.5 rounded-xl font-medium text-fg hover:bg-surface-hover min-h-[44px] flex items-center"
                >
                  {t('explore')}
                </Link>
                <Link
                  to="/communities"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-2.5 rounded-xl font-medium text-fg hover:bg-surface-hover min-h-[44px] flex items-center"
                >
                  {t('communities')}
                </Link>
                <Link
                  to="/messages"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-2.5 rounded-xl font-medium text-fg hover:bg-surface-hover min-h-[44px] flex items-center"
                >
                  {t('messages')}
                </Link>
                <Link
                  to="/bookmarks"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-2.5 rounded-xl font-medium text-fg hover:bg-surface-hover min-h-[44px] flex items-center"
                >
                  {t('bookmarks')}
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-2.5 rounded-xl font-medium text-fg hover:bg-surface-hover min-h-[44px] flex items-center"
                >
                  {t('settings')}
                </Link>
                {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-2.5 rounded-xl font-medium text-primary-text hover:bg-surface-hover flex items-center justify-between min-h-[44px]"
                >
                  <span>{t('admin')}</span>
                  <ShieldCheck className="w-4 h-4" />
                </Link>
                )}
              </nav>
            </div>

            {/* Bottom controls */}
            <div className="flex flex-col gap-3 pt-4 border-t border-border">
              <div className="flex items-center justify-between text-xs text-fg-muted">
                <button
                  onClick={toggleLanguage}
                  className="flex items-center gap-1.5 p-2 rounded-lg bg-surface-hover text-fg"
                  aria-label={t('toggleLanguage')}
                >
                  <Globe className="w-4 h-4 text-primary" />
                  <span>{language === 'en' ? 'العربية' : 'English'}</span>
                </button>
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-1.5 p-2 rounded-lg bg-surface-hover text-fg"
                  aria-label={t('toggleTheme')}
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                  <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
                </button>
              </div>

              {!isSupabaseConfigured() && (
                <button
                  onClick={() => {
                    switchRole(user?.role === 'admin' ? 'user' : 'admin');
                    setDrawerOpen(false);
                  }}
                  className="w-full text-xs text-center py-2 px-3 rounded-lg bg-primary/10 border border-primary/20 text-primary-text"
                >
                  {user?.role === 'admin' ? t('switchRoleNowAdmin') : t('switchRoleNowUser')}
                </button>
              )}

              <button
                onClick={() => {
                  logout();
                  setDrawerOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-500/20"
              >
                <LogOut className="w-4 h-4 rtl:-scale-x-100" />
                <span>{t('logout')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
