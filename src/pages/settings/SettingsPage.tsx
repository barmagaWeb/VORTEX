import React, { useEffect, useState } from 'react';
import {
  User,
  Shield,
  Palette,
  Globe,
  Bell,
  Ban,
  Check,
  Moon,
  Sun,
  Save,
  Loader2,
  LockKeyhole,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Input, Textarea } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { settingsService } from '../../services/supabase/SupabaseSettingsService';
import type { BlockedAccount, UserSettings } from '../../services/supabase/SupabaseSettingsService';

export const SettingsPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();

  const [activeSection, setActiveSection] = useState<
    'profile' | 'appearance' | 'language' | 'privacy' | 'notifications' | 'blocked'
  >('appearance');

  // Profile fields
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [location, setLocation] = useState(user?.location || '');
  const [website, setWebsite] = useState(user?.website || '');

  // Privacy & Notifications
  const [isPrivate, setIsPrivate] = useState(user?.isPrivate || false);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState<BlockedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUnblocking, setIsUnblocking] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [settings, blocked] = await Promise.all([
          settingsService.getSettings(),
          settingsService.getBlockedAccounts(),
        ]);
        if (!active) return;
        setTheme(settings.theme);
        setLanguage(settings.language);
        setEmailNotifs(settings.emailNotifications);
        setPushNotifs(settings.pushNotifications);
        setIsPrivate(user?.isPrivate ?? settings.isPrivate);
        setBlockedUsers(blocked);
      } catch (error) {
        if (active) showToast(error instanceof Error ? error.message : 'Unable to load account settings', 'error');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [setLanguage, setTheme, showToast, user?.isPrivate]);

  const currentSettings = (): UserSettings => ({
    theme,
    language,
    emailNotifications: emailNotifs,
    pushNotifications: pushNotifs,
    isPrivate,
  });

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      await settingsService.saveSettings(currentSettings());
      showToast(t('preferencesSaved'));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save preferences', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateUser({ name, bio, location, website, isPrivate });
      await settingsService.saveSettings(currentSettings());
      showToast(t('preferencesSaved'));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save profile', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnblock = async (id: string, username: string) => {
    setIsUnblocking(id);
    try {
      await settingsService.unblockAccount(id);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== id));
      showToast(`Unblocked @${username}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to unblock account', 'error');
    } finally {
      setIsUnblocking(null);
    }
  };

  const sections = [
    { id: 'appearance', label: t('appearanceSettings'), icon: Palette },
    { id: 'language', label: t('languageSettings'), icon: Globe },
    { id: 'profile', label: t('profileSettings'), icon: User },
    { id: 'privacy', label: t('privacySettings'), icon: Shield },
    { id: 'notifications', label: t('notificationSettings'), icon: Bell },
    { id: 'blocked', label: t('blockedSettings'), icon: Ban },
  ] as const;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 px-4 py-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-lg font-black text-white">{t('settings')}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'ar' ? 'تحكم في حسابك وتجربتك وخصوصيتك على VORTEX' : 'Manage your account, experience, and privacy on VORTEX'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[360px] items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin me-2" />
          <span className="text-sm">{language === 'ar' ? 'جارٍ تحميل إعداداتك...' : 'Loading your settings...'}</span>
        </div>
      ) : (
      <>
      <div className="mx-4 sm:mx-6 mt-5 rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-violet-950/30 p-4 sm:p-5 shadow-xl shadow-black/10">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar src={user?.avatar} alt={user?.name || 'VORTEX'} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-white truncate">{user?.name || 'VORTEX Member'}</h2>
              <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                {user?.role === 'admin' ? 'Admin' : user?.role === 'moderator' ? 'Moderator' : 'Member'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate">@{user?.username || 'account'}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {language === 'ar' ? 'إعداداتك الشخصية محفوظة في حسابك' : 'Your personal preferences are saved to your account'}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
            <Shield className="w-4 h-4 text-emerald-400" />
            {isPrivate ? (language === 'ar' ? 'حساب خاص' : 'Private account') : (language === 'ar' ? 'حساب عام' : 'Public account')}
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-6 flex flex-col md:flex-row gap-6 max-w-6xl mx-auto w-full">
        {/* Navigation Tabs */}
        <div className="w-full md:w-56 shrink-0 flex md:flex-col gap-1 overflow-x-auto no-scrollbar pb-2 md:pb-0">
          {sections.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap text-start ${
                  isActive
                    ? 'bg-violet-600/20 text-white border border-violet-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Section Content */}
        <div className="flex-1 min-w-0 p-5 sm:p-7 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-6 shadow-xl shadow-black/10">
          {/* Appearance Section */}
          {activeSection === 'appearance' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Palette className="w-5 h-5 text-violet-400" />
                <span>{t('themeMode')}</span>
              </h2>
              <p className="text-xs text-slate-400">
                Choose between VORTEX's signature deep charcoal dark mode and clean light theme.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Dark Theme Option */}
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`w-full text-start p-4 rounded-2xl border-2 transition-all ${
                    theme === 'dark'
                      ? 'border-violet-500 bg-slate-950 shadow-vortex-glow'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Moon className="w-5 h-5 text-violet-400" />
                      <span className="font-bold text-sm text-white">Dark Theme</span>
                    </div>
                    {theme === 'dark' && <Check className="w-4 h-4 text-violet-400" />}
                  </div>
                  <div className="h-16 rounded-xl bg-[#0A0D14] border border-slate-800 p-2 flex flex-col justify-between">
                    <div className="w-1/2 h-2 rounded bg-violet-600/40" />
                    <div className="w-3/4 h-2 rounded bg-slate-800" />
                  </div>
                </button>

                {/* Light Theme Option */}
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`w-full text-start p-4 rounded-2xl border-2 transition-all ${
                    theme === 'light'
                      ? 'border-violet-500 bg-slate-800 shadow-vortex-glow'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sun className="w-5 h-5 text-amber-400" />
                      <span className="font-bold text-sm text-white">Light Theme</span>
                    </div>
                    {theme === 'light' && <Check className="w-4 h-4 text-violet-400" />}
                  </div>
                  <div className="h-16 rounded-xl bg-slate-100 border border-slate-300 p-2 flex flex-col justify-between">
                    <div className="w-1/2 h-2 rounded bg-violet-500" />
                    <div className="w-3/4 h-2 rounded bg-slate-300" />
                  </div>
                </button>
              </div>
              <Button onClick={handleSavePreferences} variant="primary" size="md" disabled={isSaving}>
                {isSaving ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : t('savePreferences')}
              </Button>
            </div>
          )}

          {/* Language Section */}
          {activeSection === 'language' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-violet-400" />
                <span>{t('selectLanguage')}</span>
              </h2>
              <p className="text-xs text-slate-400">
                Switch between English (LTR) and Arabic (RTL). Layout and typography automatically adapt.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <button
                  onClick={() => {
                    setLanguage('en');
                    showToast('Language switched to English');
                  }}
                  className={`p-4 rounded-2xl border-2 text-start transition-all ${
                    language === 'en'
                      ? 'border-violet-500 bg-slate-950 shadow-vortex-glow'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-white block">English (US)</span>
                      <span className="text-xs text-slate-400 block mt-0.5">Left-to-Right layout</span>
                    </div>
                    {language === 'en' && <Check className="w-4 h-4 text-violet-400" />}
                  </div>
                </button>

                <button
                  onClick={() => {
                    setLanguage('ar');
                    showToast('تم تحويل اللغة إلى العربية بنجاح');
                  }}
                  className={`p-4 rounded-2xl border-2 text-start transition-all ${
                    language === 'ar'
                      ? 'border-violet-500 bg-slate-950 shadow-vortex-glow'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-white block">العربية (Arabic)</span>
                      <span className="text-xs text-slate-400 block mt-0.5">محاذاة كاملة من اليمين لليسار (RTL)</span>
                    </div>
                    {language === 'ar' && <Check className="w-4 h-4 text-violet-400" />}
                  </div>
                </button>
              </div>
              <Button onClick={handleSavePreferences} variant="primary" size="md" disabled={isSaving}>
                {isSaving ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : t('savePreferences')}
              </Button>
            </div>
          )}

          {/* Profile Section */}
          {activeSection === 'profile' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-violet-400" />
                <span>{t('profileSettings')}</span>
              </h2>

              <div className="space-y-3">
                <Input
                  label={t('displayName')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Textarea
                  label={t('bioLabel')}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                />
                <Input
                  label={t('locationLabel')}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <Input
                  label={t('websiteLabel')}
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />

                <Button
                  onClick={handleSaveProfile}
                  variant="primary"
                  size="md"
                  disabled={isSaving}
                  leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                >
                  {t('savePreferences')}
                </Button>
              </div>
            </div>
          )}

          {/* Privacy Section */}
          {activeSection === 'privacy' && (
            <div className="space-y-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-400" />
                <span>{t('privacySettings')}</span>
              </h2>

              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950/40 border border-slate-800">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-white block">{t('privateAccount')}</span>
                  <span className="text-xs text-slate-400">{t('privateAccountDesc')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 accent-violet-600 cursor-pointer"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 flex items-start gap-3">
                <LockKeyhole className="w-5 h-5 text-violet-400 mt-0.5" />
                <div>
                  <span className="text-sm font-semibold text-white block">Two-factor authentication</span>
                  <span className="text-xs text-slate-400 block mt-1">
                    {language === 'ar'
                      ? 'إدارة المصادقة الثنائية غير متاحة حاليًا. لن نعرضها على أنها مفعّلة قبل ربطها فعليًا.'
                      : 'Two-factor controls are not configured yet. VORTEX will not show this protection as enabled until it is actually connected.'}
                  </span>
                </div>
              </div>

              <Button onClick={handleSaveProfile} variant="primary" size="md" disabled={isSaving}>
                {isSaving ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : t('savePreferences')}
              </Button>
            </div>
          )}

          {/* Notifications Section */}
          {activeSection === 'notifications' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-violet-400" />
                <span>{t('notificationSettings')}</span>
              </h2>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-semibold text-slate-200">{t('emailNotifications')}</span>
                  <input
                    type="checkbox"
                    checked={emailNotifs}
                    onChange={(e) => setEmailNotifs(e.target.checked)}
                    className="accent-violet-600 w-4 h-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-semibold text-slate-200">{t('pushNotifications')}</span>
                  <input
                    type="checkbox"
                    checked={pushNotifs}
                    onChange={(e) => setPushNotifs(e.target.checked)}
                    className="accent-violet-600 w-4 h-4 cursor-pointer"
                  />
                </label>

                <Button
                  onClick={handleSavePreferences}
                  variant="primary"
                  size="md"
                  disabled={isSaving}
                >
                  {isSaving ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : t('savePreferences')}
                </Button>
              </div>
            </div>
          )}

          {/* Blocked Accounts Section */}
          {activeSection === 'blocked' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-400" />
                <span>{t('blockedUsersList')}</span>
              </h2>

              {blockedUsers.length === 0 ? (
                <p className="text-xs text-slate-400">{t('noBlockedUsers')}</p>
              ) : (
                <div className="space-y-2">
                  {blockedUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">{u.name}</span>
                        <span className="text-[11px] text-slate-500">@{u.username}</span>
                      </div>
                      <Button
                        onClick={() => void handleUnblock(u.id, u.username)}
                        variant="outline"
                        size="sm"
                        disabled={isUnblocking === u.id}
                        className="text-xs"
                      >
                        {isUnblocking === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('unblock')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
};
