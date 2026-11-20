import { IAuthService } from '../interfaces/IAuthService';
import { User } from '../../types';
import { CURRENT_USER, ADMIN_USER, MOCK_USERS } from '../../constants/mockData';
import { storage } from './storage';

const STORAGE_KEY_AUTH = 'vortex_auth_user';

export class MockAuthService implements IAuthService {
  private assertMockAllowed(): void {
    if (import.meta.env.PROD) {
      throw new Error('Mock authentication is disabled in production. Configure Supabase to use VORTEX.');
    }
  }

  async getCurrentUser(): Promise<User | null> {
    this.assertMockAllowed();
    const saved = storage.get<User | null>(STORAGE_KEY_AUTH, CURRENT_USER);
    return saved;
  }

  async signIn(email: string, _password?: string): Promise<User> {
    this.assertMockAllowed();
    // Demo accounts are matched exactly; arbitrary strings containing 'admin'
    // must never be interpreted as an administrator login.
    const normalizedEmailOrUsername = email.trim().toLowerCase();
    const emailUsername = normalizedEmailOrUsername.split('@')[0];
    const match = MOCK_USERS.find((candidate) =>
      candidate.username.toLowerCase() === normalizedEmailOrUsername ||
      candidate.username.toLowerCase() === emailUsername
    );
    const user: User = match || CURRENT_USER;
    storage.set(STORAGE_KEY_AUTH, user);
    return user;
  }

  async signUp(_email: string, _password: string, name: string, username: string): Promise<User> {
    this.assertMockAllowed();
    const newUser: User = {
      id: `usr_${Date.now()}`,
      email: _email,
      emailVerified: true,
      name: name || 'Vortex Pioneer',
      username: username ? username.replace('@', '') : `user_${Math.floor(Math.random() * 8999 + 1000)}`,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
      bio: 'New explorer on VORTEX. Ready to connect and discover.',
      followersCount: 0,
      followingCount: 5,
      postsCount: 0,
      joinedDate: 'Just now',
      verified: false,
      role: 'user',
    };
    storage.set(STORAGE_KEY_AUTH, newUser);
    return newUser;
  }

  async verifyEmailOtp(_email: string, _token: string): Promise<User> {
    this.assertMockAllowed();
    const user = await this.getCurrentUser();
    if (!user) throw new Error('No pending account was found.');
    const verified = { ...user, emailVerified: true };
    storage.set(STORAGE_KEY_AUTH, verified);
    return verified;
  }

  async resendConfirmationEmail(_email: string): Promise<boolean> {
    this.assertMockAllowed();
    await new Promise((r) => setTimeout(r, 250));
    return true;
  }

  async hasAdminRole(): Promise<boolean> {
    this.assertMockAllowed();
    const user = await this.getCurrentUser();
    return user?.role === 'admin';
  }

  async requestPasswordReset(_email: string): Promise<boolean> {
    this.assertMockAllowed();
    // Simulated mock latency
    await new Promise((r) => setTimeout(r, 400));
    return true;
  }

  async resetPassword(_password: string): Promise<boolean> {
    this.assertMockAllowed();
    await new Promise((r) => setTimeout(r, 400));
    return true;
  }

  async signOut(): Promise<void> {
    this.assertMockAllowed();
    storage.remove(STORAGE_KEY_AUTH);
  }

  async switchDemoRole(role: 'user' | 'admin'): Promise<User> {
    this.assertMockAllowed();
    const user = role === 'admin' ? ADMIN_USER : CURRENT_USER;
    storage.set(STORAGE_KEY_AUTH, user);
    return user;
  }
}
