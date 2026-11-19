import { User } from '../../types';

export interface IUserService {
  /**
   * Retrieves user profile by username or id.
   * Future Supabase hook: supabase.from('profiles').select('*').eq('username', username).single()
   */
  getUserByUsername(username: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;

  /**
   * Updates current user's profile attributes.
   * Future Supabase hook: supabase.from('profiles').update(data).eq('id', userId)
   */
  updateProfile(userId: string, data: Partial<User>): Promise<User>;

  /**
   * Follows or unfollows a target user.
   * Future Supabase hook: supabase.from('follows').insert/delete
   */
  toggleFollow(targetUserId: string): Promise<{ isFollowing: boolean; isPending?: boolean; newFollowersCount: number }>;

  /**
   * Blocks or unblocks a target user.
   * Future Supabase hook: supabase.from('blocks').insert/delete
   */
  toggleBlock(targetUserId: string): Promise<boolean>;

  /**
   * Returns list of suggested accounts to follow.
   */
  getSuggestedUsers(limit?: number): Promise<User[]>;

  /**
   * Searches users by query.
   */
  searchUsers(query: string): Promise<User[]>;
}
