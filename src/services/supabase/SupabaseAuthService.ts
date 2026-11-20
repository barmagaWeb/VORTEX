import { IAuthService } from '../interfaces/IAuthService';
import { User } from '../../types';
import { supabase, isSupabaseConfigured } from './client';
import { MockAuthService } from '../mock/MockAuthService';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

const getAppRedirectUrl = (path: string): string => {
  const configuredBase = String(import.meta.env.VITE_APP_URL || '').trim();
  const fallbackBase = import.meta.env.DEV
    ? 'https://vortex-4fl.pages.dev'
    : window.location.origin;
  const base = configuredBase || fallbackBase;
  return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
};

export class SupabaseAuthService implements IAuthService {
  private fallbackMock = new MockAuthService();

  private async mapCurrentUser(
    authUser: {
      id: string;
      email?: string;
      email_confirmed_at?: string | null;
      created_at: string;
      user_metadata?: Record<string, unknown>;
    }
  ): Promise<User> {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to load account profile: ${error.message}`);
    }

    if (!profile) {
      return {
        id: authUser.id,
        email: authUser.email || undefined,
        emailVerified: Boolean(authUser.email_confirmed_at),
        name: String(authUser.user_metadata?.name || 'VORTEX User'),
        username: String(authUser.user_metadata?.username || `user_${authUser.id.slice(0, 6)}`),
        avatar: String(authUser.user_metadata?.avatar || DEFAULT_AVATAR),
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        joinedDate: new Date(authUser.created_at).toLocaleDateString(),
        role: 'user',
      };
    }

    return {
      id: profile.id,
      email: authUser.email || undefined,
      emailVerified: Boolean(authUser.email_confirmed_at),
      name: profile.name,
      username: profile.username,
      avatar: profile.avatar || DEFAULT_AVATAR,
      coverImage: profile.cover_image,
      bio: profile.bio,
      location: profile.location,
      website: profile.website,
      verified: profile.verified,
      followersCount: profile.followers_count || 0,
      followingCount: profile.following_count || 0,
      postsCount: profile.posts_count || 0,
      joinedDate: new Date(profile.created_at).toLocaleDateString(),
      role: profile.role || 'user',
      isPrivate: profile.is_private,
    };
  }

  async getCurrentUser(): Promise<User | null> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getCurrentUser();
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;
    return this.mapCurrentUser(user);
  }

  async signIn(email: string, password?: string): Promise<User> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.signIn(email, password);
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: password || '',
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Sign-in did not return an authenticated user.');
    }

    return this.mapCurrentUser(data.user);
  }

  async signUp(email: string, password: string, name: string, username: string): Promise<User> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.signUp(email, password, name, username);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)
      || ['admin', 'administrator', 'moderator', 'support', 'system', 'root', 'vortex'].includes(normalizedUsername)) {
      throw new Error('Username must be 3-24 letters, numbers or underscores and cannot be reserved.');
    }

    const { data: existingUsername, error: usernameLookupError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', normalizedUsername)
      .limit(1)
      .maybeSingle();
    if (usernameLookupError) throw new Error(`Unable to validate username: ${usernameLookupError.message}`);
    if (existingUsername) throw new Error('That username is already in use. Choose another one.');

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: getAppRedirectUrl('/auth/verify'),
        data: {
          name,
          username: normalizedUsername,
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Registration failed. Please try again.');
    }
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('An account with this email already exists. Sign in or use password recovery.');
    }

    return {
      id: data.user.id,
      email: data.user.email || email,
      emailVerified: Boolean(data.user.email_confirmed_at),
      name,
      username: normalizedUsername,
      avatar: DEFAULT_AVATAR,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      joinedDate: 'Just now',
      role: 'user',
    };
  }

  async verifyEmailOtp(email: string, token: string): Promise<User> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.verifyEmailOtp(email, token);
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'signup',
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Email verification did not return a user session.');
    return this.mapCurrentUser(data.user);
  }

  async requestPasswordReset(email: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.requestPasswordReset(email);
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAppRedirectUrl('/auth/reset'),
    });

    if (error) throw new Error(error.message);
    return true;
  }

  async resetPassword(password: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.resetPassword(password);
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
    return true;
  }

  async resendConfirmationEmail(email: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.resendConfirmationEmail(email);
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: getAppRedirectUrl('/auth/verify'),
      },
    });

    if (error) throw new Error(error.message);
    return true;
  }

  async hasAdminRole(): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      const user = await this.fallbackMock.getCurrentUser();
      return user?.role === 'admin';
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return false;

    const { data, error } = await supabase.rpc('has_admin_access');
    return !error && data === true;
  }

  async signOut(): Promise<void> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.signOut();
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }

  async switchDemoRole(role: 'user' | 'admin'): Promise<User> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.switchDemoRole(role);
    }

    const currentUser = await this.getCurrentUser();
    if (!currentUser) throw new Error('Authentication required');
    return currentUser;
  }
}
