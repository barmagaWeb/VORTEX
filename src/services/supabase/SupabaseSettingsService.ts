import { supabase, isSupabaseConfigured } from './client';
import type { Theme, Language } from '../../types';

export interface UserSettings {
  theme: Theme;
  language: Language;
  emailNotifications: boolean;
  pushNotifications: boolean;
  isPrivate: boolean;
}

export interface BlockedAccount {
  id: string;
  name: string;
  username: string;
  avatar?: string;
}

const defaults: UserSettings = {
  theme: 'dark',
  language: 'en',
  emailNotifications: true,
  pushNotifications: true,
  isPrivate: false,
};

export class SupabaseSettingsService {
  async getSettings(): Promise<UserSettings> {
    if (!isSupabaseConfigured()) return defaults;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(authError.message);
    if (!user) throw new Error('Authentication required');

    const { data, error } = await supabase
      .from('user_settings')
      .select('theme, language, email_notifications, push_notifications, is_private')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return defaults;

    return {
      theme: data.theme === 'light' ? 'light' : 'dark',
      language: data.language === 'ar' ? 'ar' : 'en',
      emailNotifications: data.email_notifications ?? true,
      pushNotifications: data.push_notifications ?? true,
      isPrivate: data.is_private ?? false,
    };
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(authError.message);
    if (!user) throw new Error('Authentication required');

    const { error } = await supabase.from('user_settings').upsert({
      user_id: user.id,
      theme: settings.theme,
      language: settings.language,
      email_notifications: settings.emailNotifications,
      push_notifications: settings.pushNotifications,
      is_private: settings.isPrivate,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (error) throw new Error(error.message);
  }

  async getBlockedAccounts(): Promise<BlockedAccount[]> {
    if (!isSupabaseConfigured()) return [];
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(authError.message);
    if (!user) throw new Error('Authentication required');

    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocked_id, profiles!user_blocks_blocked_id_fkey(id, name, username, avatar)')
      .eq('blocker_id', user.id);

    if (error) throw new Error(error.message);
    return (data || []).flatMap((row: any) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      if (!profile) return [];
      return [{
        id: profile.id,
        name: profile.name || 'VORTEX Member',
        username: profile.username || '',
        avatar: profile.avatar || '',
      }];
    });
  }

  async unblockAccount(blockedUserId: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(authError.message);
    if (!user) throw new Error('Authentication required');

    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', blockedUserId);
    if (error) throw new Error(error.message);
  }
}

export const settingsService = new SupabaseSettingsService();
