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
import { translations } from '../../constants/translations';
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
        if (active) showToast(error instanceof Error ? error.message : t('errLoadSettingsFailed'), 'error');
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
      showToast(error instanceof Error ? error.message : t('errSavePreferencesFailed'), 'error');
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
      showToast(error instanceof Error ? error.message : t('errSaveProfileFailed'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnblock = async (id: string, username: string) => {
    setIsUnblocking(id);
    try {
      await settingsService.unblockAccount(id);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== id));
      showToast(t('toastUnblocked', { username }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('errUnblockFailed'), 'error');
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
    <div className="flex flex-col min-h-[100dvh]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-surface/85 backdrop-blur-xl border-b border-border px-4 py-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-lg font-black text-fg">{t('settings')}</h1>
          <p className="text-xs text-fg-subtle mt-1">
            {t('settingsSubtitle')}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[360px] items-center justify-center text-fg-muted">
          <Loader2 className="h-5 w-5 animate-spin me-2" />
          <span className="text-sm">{t('loadingSettings')}</span>
        </div>
      ) : (
      <>
      <div className="mx-4 sm:mx-6 mt-5 rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-primary/10 p-4 sm:p-5 shadow-card">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar src={user?.avatar} alt={user?.name || 'VORTEX'} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-fg truncate">{user?.name || t('vortexMember')}</h2>
              <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary-text">
                {user?.role === 'admin' ? t('roleAdmin') : user?.role === 'moderator' ? t('roleModerator') : t('roleMember')}
              </span>
            </div>
            <p className="text-xs text-fg-muted mt-1 truncate">@{user?.username || t('accountHandleFallback')}</p>
            <p className="text-[11px] text-fg-subtle mt-1">
              {t('settingsSavedToAccount')}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-xs text-fg-muted">
            <Shield className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            {isPrivate ? t('accountIsPrivate') : t('accountIsPublic')}
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
                    ? 'bg-primary/10 text-fg border border-primary/30'
                    : 'text-fg-muted hover:text-fg hover:bg-surface-hover'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Section Content */}
        <div className="flex-1 min-w-0 p-5 sm:p-7 rounded-2xl bg-surface border border-border space-y-6 shadow-card">
          {/* Appearance Section */}
          {activeSection === 'appearance' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-fg flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                <span>{t('themeMode')}</span>
              </h2>
              <p className="text-xs text-fg-muted">
                {t('themeDescription')}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Dark Theme Option */}
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`w-full text-start p-4 rounded-2xl border-2 transition-all ${
                    theme === 'dark'
                      ? 'border-primary bg-bg shadow-vortex-glow'
                      : 'border-border bg-bg/60 hover:border-fg-subtle'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Moon className="w-5 h-5 text-primary" />
                      <span className="font-bold text-sm text-fg">{t('darkThemeName')}</span>
                    </div>
                    {theme === 'dark' && <Check className="w-4 h-4 text-primary" />}
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
                      ? 'border-primary bg-bg shadow-vortex-glow'
                      : 'border-border bg-bg/60 hover:border-fg-subtle'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sun className="w-5 h-5 text-warning" />
                      <span className="font-bold text-sm text-fg">{t('lightThemeName')}</span>
                    </div>
                    {theme === 'light' && <Check className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="h-16 rounded-xl bg-slate-100 border border-slate-300 p-2 flex flex-col justify-between">
                    <div className="w-1/2 h-2 rounded bg-violet-500" />
                    <div className="w-3/4 h-2 rounded bg-slate-300" />
                  </div>
                </button>
              </div>
              <Button onClick={handleSavePreferences} variant="primary" size="md" disabled={isSaving}>
                {isSaving ? t('saving') : t('savePreferences')}
              </Button>
            </div>
          )}

          {/* Language Section */}
          {activeSection === 'language' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-fg flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                <span>{t('selectLanguage')}</span>
              </h2>
              <p className="text-xs text-fg-muted">
                {t('languageDescription')}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <button
                  onClick={() => {
                    setLanguage('en');
                    showToast(translations.en.languageSwitched);
                  }}
                  className={`p-4 rounded-2xl border-2 text-start transition-all ${
                    language === 'en'
                      ? 'border-primary bg-bg shadow-vortex-glow'
                      : 'border-border bg-bg/60 hover:border-fg-subtle'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-fg block">English (US)</span>
                      <span className="text-xs text-fg-muted block mt-0.5">{t('layoutLtr')}</span>
                    </div>
                    {language === 'en' && <Check className="w-4 h-4 text-primary" />}
                  </div>
                </button>

                <button
                  onClick={() => {
                    setLanguage('ar');
                    showToast(translations.ar.languageSwitched);
                  }}
                  className={`p-4 rounded-2xl border-2 text-start transition-all ${
                    language === 'ar'
                      ? 'border-primary bg-bg shadow-vortex-glow'
                      : 'border-border bg-bg/60 hover:border-fg-subtle'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-fg block">العربية (Arabic)</span>
                      <span className="text-xs text-fg-muted block mt-0.5">{t('layoutRtl')}</span>
                    </div>
                    {language === 'ar' && <Check className="w-4 h-4 text-primary" />}
                  </div>
                </button>
              </div>
              <Button onClick={handleSavePreferences} variant="primary" size="md" disabled={isSaving}>
                {isSaving ? t('saving') : t('savePreferences')}
              </Button>
            </div>
          )}

          {/* Profile Section */}
          {activeSection === 'profile' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-fg flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
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
              <h2 className="text-base font-bold text-fg flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <span>{t('privacySettings')}</span>
              </h2>

              <div className="flex items-center justify-between p-4 rounded-xl bg-bg border border-border">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-fg block">{t('privateAccount')}</span>
                  <span className="text-xs text-fg-muted">{t('privateAccountDesc')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                />
              </div>

              <div className="p-4 rounded-xl bg-bg border border-border flex items-start gap-3">
                <LockKeyhole className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <span className="text-sm font-semibold text-fg block">{t('twoFactorAuth')}</span>
                  <span className="text-xs text-fg-muted block mt-1">
                    {t('twoFactorNotConfigured')}
                  </span>
                </div>
              </div>

              <Button onClick={handleSaveProfile} variant="primary" size="md" disabled={isSaving}>
                {isSaving ? t('saving') : t('savePreferences')}
              </Button>
            </div>
          )}

          {/* Notifications Section */}
          {activeSection === 'notifications' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-fg flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <span>{t('notificationSettings')}</span>
              </h2>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-3.5 rounded-xl bg-bg border border-border cursor-pointer">
                  <span className="text-xs font-semibold text-fg">{t('emailNotifications')}</span>
                  <input
                    type="checkbox"
                    checked={emailNotifs}
                    onChange={(e) => setEmailNotifs(e.target.checked)}
                    className="accent-primary w-4 h-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-bg border border-border cursor-pointer">
                  <span className="text-xs font-semibold text-fg">{t('pushNotifications')}</span>
                  <input
                    type="checkbox"
                    checked={pushNotifs}
                    onChange={(e) => setPushNotifs(e.target.checked)}
                    className="accent-primary w-4 h-4 cursor-pointer"
                  />
                </label>

                <Button
                  onClick={handleSavePreferences}
                  variant="primary"
                  size="md"
                  disabled={isSaving}
                >
                  {isSaving ? t('saving') : t('savePreferences')}
                </Button>
              </div>
            </div>
          )}

          {/* Blocked Accounts Section */}
          {activeSection === 'blocked' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-fg flex items-center gap-2">
                <Ban className="w-5 h-5 text-danger" />
                <span>{t('blockedUsersList')}</span>
              </h2>

              {blockedUsers.length === 0 ? (
                <p className="text-xs text-fg-muted">{t('noBlockedUsers')}</p>
              ) : (
                <div className="space-y-2">
                  {blockedUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-bg border border-border"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-fg">{u.name}</span>
                        <span className="text-[11px] text-fg-subtle">@{u.username}</span>
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
