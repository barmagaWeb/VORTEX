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

export const MobileTopNav: React.FC<MobileTopNavProps> = ({ unreadNotifsCount = 3 }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, logout, switchRole } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <>
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 select-none">
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Open navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Logo size="sm" />

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/explore')}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>
          <Link
            to="/notifications"
            className="relative p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifsCount > 0 && (
              <span className="absolute top-1 end-1 w-2 h-2 rounded-full bg-rose-500" />
            )}
          </Link>
        </div>
      </header>

      {/* Mobile slide-over drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative w-4/5 max-w-xs bg-slate-900 border-e border-slate-800 h-full p-5 flex flex-col justify-between z-10 shadow-2xl">
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <Logo size="sm" showTagline />
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation links */}
              <nav className="flex flex-col gap-2 pt-2">
                <Link
                  to="/feed"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-2.5 rounded-xl font-medium text-slate-200 hover:bg-slate-800"
                >
                  {t('home')}
                </Link>
                <Link
                  to="/explore"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-2.5 rounded-xl font-medium text-slate-200 hover:bg-slate-800"
                >
                  {t('explore')}
                </Link>
                <Link
                  to="/communities"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-2.5 rounded-xl font-medium text-slate-200 hover:bg-slate-800"
                >
                  {t('communities')}
                </Link>
                <Link
                  to="/messages"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-2.5 rounded-xl font-medium text-slate-200 hover:bg-slate-800"
                >
                  {t('messages')}
                </Link>
                <Link
                  to="/bookmarks"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-2.5 rounded-xl font-medium text-slate-200 hover:bg-slate-800"
                >
                  {t('bookmarks')}
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-2.5 rounded-xl font-medium text-slate-200 hover:bg-slate-800"
                >
                  {t('settings')}
                </Link>
                <Link
                  to="/admin"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-2.5 rounded-xl font-medium text-violet-400 hover:bg-slate-800 flex items-center justify-between"
                >
                  <span>{t('admin')}</span>
                  <ShieldCheck className="w-4 h-4" />
                </Link>
              </nav>
            </div>

            {/* Bottom controls */}
            <div className="flex flex-col gap-3 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <button
                  onClick={toggleLanguage}
                  className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-800/80 text-slate-200"
                >
                  <Globe className="w-4 h-4 text-violet-400" />
                  <span>{language === 'en' ? 'العربية' : 'English'}</span>
                </button>
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-800/80 text-slate-200"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
                  <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
                </button>
              </div>

              {!isSupabaseConfigured() && <button
                onClick={() => {
                  switchRole(user?.role === 'admin' ? 'user' : 'admin');
                  setDrawerOpen(false);
                }}
                className="w-full text-xs text-center py-2 px-3 rounded-lg bg-violet-950/40 border border-violet-500/30 text-violet-300"
              >
                Switch Role: {user?.role === 'admin' ? 'Now Admin' : 'Now User'}
              </button>}

              <button
                onClick={() => {
                  logout();
                  setDrawerOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-rose-500/10 text-rose-300 text-xs font-semibold hover:bg-rose-500/20"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('logout')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
