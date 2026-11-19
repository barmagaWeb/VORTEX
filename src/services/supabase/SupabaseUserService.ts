import { IUserService } from '../interfaces/IUserService';
import { User } from '../../types';
import { supabase, isSupabaseConfigured } from './client';
import { MockUserService } from '../mock/MockUserService';
import { escapeLikeLiteral } from './query';

export class SupabaseUserService implements IUserService {
  private fallbackMock = new MockUserService();

  private async applyFollowStatuses(users: User[]): Promise<User[]> {
    if (!isSupabaseConfigured() || users.length === 0) return users;
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user.id;
    if (!currentUserId) return users;

    const { data, error } = await supabase
      .from('follows')
      .select('following_id, status')
      .eq('follower_id', currentUserId)
      .in('following_id', users.map((user) => user.id));
    if (error || !data) return users;

    const statusByUserId = new Map(data.map((follow) => [follow.following_id, follow.status]));
    return users.map((user) => ({
      ...user,
      isFollowing: statusByUserId.get(user.id) === 'accepted',
      isFollowPending: statusByUserId.get(user.id) === 'pending',
    }));
  }

  async getUserByUsername(username: string): Promise<User | null> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getUserByUsername(username);
    }

    const clean = username.replace('@', '').toLowerCase();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', clean)
      .single();

    if (error || !data) return null;

    const profile: User = {
      id: data.id,
      name: data.name,
      username: data.username,
      avatar: data.avatar,
      coverImage: data.cover_image,
      bio: data.bio,
      location: data.location,
      website: data.website,
      verified: data.verified,
      followersCount: data.followers_count || 0,
      followingCount: data.following_count || 0,
      postsCount: data.posts_count || 0,
      joinedDate: new Date(data.created_at).toLocaleDateString(),
      role: data.role || 'user',
      isPrivate: data.is_private,
    };
    return (await this.applyFollowStatuses([profile]))[0];
  }

  async getUserById(id: string): Promise<User | null> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getUserById(id);
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    const profile: User = {
      id: data.id,
      name: data.name,
      username: data.username,
      avatar: data.avatar,
      coverImage: data.cover_image,
      bio: data.bio,
      location: data.location,
      website: data.website,
      verified: data.verified,
      followersCount: data.followers_count || 0,
      followingCount: data.following_count || 0,
      postsCount: data.posts_count || 0,
      joinedDate: new Date(data.created_at).toLocaleDateString(),
      role: data.role || 'user',
      isPrivate: data.is_private,
    };
    return (await this.applyFollowStatuses([profile]))[0];
  }

  async updateProfile(userId: string, data: Partial<User>): Promise<User> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.updateProfile(userId, data);
    }

    const updatePayload: Record<string, any> = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.bio !== undefined) updatePayload.bio = data.bio;
    if (data.location !== undefined) updatePayload.location = data.location;
    if (data.website !== undefined) updatePayload.website = data.website;
    if (data.avatar !== undefined) updatePayload.avatar = data.avatar;
    if (data.coverImage !== undefined) updatePayload.cover_image = data.coverImage;
    if (data.isPrivate !== undefined) updatePayload.is_private = data.isPrivate;
    updatePayload.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    return {
      id: updated.id,
      name: updated.name,
      username: updated.username,
      avatar: updated.avatar,
      coverImage: updated.cover_image,
      bio: updated.bio,
      location: updated.location,
      website: updated.website,
      verified: updated.verified,
      followersCount: updated.followers_count || 0,
      followingCount: updated.following_count || 0,
      postsCount: updated.posts_count || 0,
      joinedDate: new Date(updated.created_at).toLocaleDateString(),
      role: updated.role || 'user',
      isPrivate: updated.is_private,
    };
  }

  async toggleFollow(targetUserId: string): Promise<{ isFollowing: boolean; isPending?: boolean; newFollowersCount: number }> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.toggleFollow(targetUserId);
    }

    const { data, error } = await supabase.rpc('toggle_follow', { target_user_id: targetUserId });
    if (error) throw new Error(error.message);
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error('The follow operation did not return a result.');

    return {
      isFollowing: Boolean(result.is_following),
      isPending: Boolean(result.is_pending),
      newFollowersCount: Number(result.followers_count || 0),
    };
  }

  async toggleBlock(targetUserId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.toggleBlock(targetUserId);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const { data: existing, error: lookupError } = await supabase
      .from('user_blocks')
      .select('blocker_id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', targetUserId)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);

    const mutation = existing
      ? await supabase.from('user_blocks').delete().eq('blocker_id', user.id).eq('blocked_id', targetUserId)
      : await supabase.from('user_blocks').insert({ blocker_id: user.id, blocked_id: targetUserId });
    if (mutation.error) throw new Error(mutation.error.message);
    return !existing;
  }

  async getSuggestedUsers(limit = 4): Promise<User[]> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getSuggestedUsers(limit);
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_suspended', false)
      .limit(limit);

    if (error || !data) return [];

    const mapped = data.map((d) => ({
      id: d.id,
      name: d.name,
      username: d.username,
      avatar: d.avatar,
      coverImage: d.cover_image,
      bio: d.bio,
      location: d.location,
      website: d.website,
      verified: d.verified,
      followersCount: d.followers_count || 0,
      followingCount: d.following_count || 0,
      postsCount: d.posts_count || 0,
      joinedDate: new Date(d.created_at).toLocaleDateString(),
      role: d.role || 'user',
      isPrivate: d.is_private,
    }));
    return this.applyFollowStatuses(mapped);
  }

  async searchUsers(query: string): Promise<User[]> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.searchUsers(query);
    }

    const q = query.trim();
    if (!q) return [];

    const pattern = `%${escapeLikeLiteral(q)}%`;
    const searches = await Promise.all([
      supabase.from('profiles').select('*').ilike('username', pattern).limit(20),
      supabase.from('profiles').select('*').ilike('name', pattern).limit(20),
      supabase.from('profiles').select('*').ilike('bio', pattern).limit(20),
    ]);
    const failedSearch = searches.find((result) => result.error);
    if (failedSearch?.error) throw new Error(failedSearch.error.message);
    const uniqueUsers = new Map<string, NonNullable<(typeof searches)[number]['data']>[number]>();
    searches.forEach(({ data }) => (data || []).forEach((profile) => uniqueUsers.set(profile.id, profile)));
    const data = Array.from(uniqueUsers.values());

    const mapped = data.map((d) => ({
      id: d.id,
      name: d.name,
      username: d.username,
      avatar: d.avatar,
      coverImage: d.cover_image,
      bio: d.bio,
      location: d.location,
      website: d.website,
      verified: d.verified,
      followersCount: d.followers_count || 0,
      followingCount: d.following_count || 0,
      postsCount: d.posts_count || 0,
      joinedDate: new Date(d.created_at).toLocaleDateString(),
      role: d.role || 'user',
      isPrivate: d.is_private,
    }));
    return this.applyFollowStatuses(mapped);
  }
}
