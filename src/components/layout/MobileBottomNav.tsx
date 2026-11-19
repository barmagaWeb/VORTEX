import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Plus, Bell, User as UserIcon } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

interface MobileBottomNavProps {
  onOpenCreatePost: () => void;
  unreadNotifsCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onOpenCreatePost,
  unreadNotifsCount = 0,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/90 backdrop-blur-lg border-t border-slate-800/80 px-2 py-2 flex items-center justify-around select-none">
      {/* Home */}
      <NavLink
        to="/feed"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center p-2 rounded-xl transition-colors ${
            isActive ? 'text-violet-400' : 'text-slate-400 hover:text-slate-200'
          }`
        }
        aria-label={t('home')}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 font-medium">{t('home')}</span>
      </NavLink>

      {/* Center Floating Create Post Button */}
      <button
        onClick={onOpenCreatePost}
        className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-tr from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-600/40 -mt-5 active:scale-90 transition-transform border-2 border-slate-950 focus:outline-none"
        aria-label={t('createPost')}
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* Notifications */}
      <NavLink
        to="/notifications"
        className={({ isActive }) =>
          `relative flex flex-col items-center justify-center p-2 rounded-xl transition-colors ${
            isActive ? 'text-violet-400' : 'text-slate-400 hover:text-slate-200'
          }`
        }
        aria-label={t('notifications')}
      >
        <div className="relative">
          <Bell className="w-5 h-5" />
          {unreadNotifsCount > 0 && (
            <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-slate-900" />
          )}
        </div>
        <span className="text-[10px] mt-0.5 font-medium">{t('notifications')}</span>
      </NavLink>

      {/* Profile */}
      <NavLink
        to={user ? `/profile/${user.username}` : '/profile'}
        className={({ isActive }) =>
          `flex flex-col items-center justify-center p-2 rounded-xl transition-colors ${
            isActive ? 'text-violet-400' : 'text-slate-400 hover:text-slate-200'
          }`
        }
        aria-label={t('profile')}
      >
        {user ? (
          <Avatar src={user.avatar} alt={user.name} size="xs" />
        ) : (
          <UserIcon className="w-5 h-5" />
        )}
        <span className="text-[10px] mt-0.5 font-medium">{t('profile')}</span>
      </NavLink>
    </nav>
  );
};
