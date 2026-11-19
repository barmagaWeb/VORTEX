import { IUserService } from '../interfaces/IUserService';
import { User } from '../../types';
import { MOCK_USERS, CURRENT_USER } from '../../constants/mockData';
import { storage } from './storage';

const STORAGE_KEY_USERS = 'vortex_users_store';

export class MockUserService implements IUserService {
  private getUsersStore(): User[] {
    return storage.get<User[]>(STORAGE_KEY_USERS, MOCK_USERS);
  }

  private saveUsersStore(users: User[]): void {
    storage.set(STORAGE_KEY_USERS, users);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const clean = username.replace('@', '').toLowerCase();
    const users = this.getUsersStore();
    return users.find((u) => u.username.toLowerCase() === clean) || null;
  }

  async getUserById(id: string): Promise<User | null> {
    const users = this.getUsersStore();
    return users.find((u) => u.id === id) || null;
  }

  async updateProfile(userId: string, data: Partial<User>): Promise<User> {
    const users = this.getUsersStore();
    const index = users.findIndex((u) => u.id === userId);
    
    // Protect role from arbitrary client elevation
    const safeData = { ...data };
    delete safeData.role;

    if (index === -1) {
      const updated = { ...CURRENT_USER, ...safeData, id: userId };
      users.push(updated);
      this.saveUsersStore(users);
      return updated;
    }
    users[index] = { ...users[index], ...safeData };
    this.saveUsersStore(users);
    return users[index];
  }

  async toggleFollow(targetUserId: string): Promise<{ isFollowing: boolean; isPending?: boolean; newFollowersCount: number }> {
    const users = this.getUsersStore();
    const target = users.find((u) => u.id === targetUserId);
    if (!target) {
      return { isFollowing: true, isPending: false, newFollowersCount: 1 };
    }
    const isNowFollowing = !target.isFollowing;
    target.isFollowing = isNowFollowing;
    target.followersCount = isNowFollowing
      ? target.followersCount + 1
      : Math.max(0, target.followersCount - 1);

    this.saveUsersStore(users);
    return { isFollowing: isNowFollowing, isPending: false, newFollowersCount: target.followersCount };
  }

  async toggleBlock(targetUserId: string): Promise<boolean> {
    const users = this.getUsersStore();
    const target = users.find((u) => u.id === targetUserId);
    if (!target) return true;
    target.isBlocked = !target.isBlocked;
    if (target.isBlocked) {
      target.isFollowing = false;
    }
    this.saveUsersStore(users);
    return !!target.isBlocked;
  }

  async getSuggestedUsers(limit = 4): Promise<User[]> {
    const users = this.getUsersStore();
    // Exclude current user and blocked
    return users.filter((u) => u.id !== 'usr_me' && !u.isBlocked).slice(0, limit);
  }

  async searchUsers(query: string): Promise<User[]> {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const users = this.getUsersStore();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.bio && u.bio.toLowerCase().includes(q))
    );
  }
}
