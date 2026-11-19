import { ICommunityService, CreateCommunityDTO } from '../interfaces/ICommunityService';
import { Community } from '../../types';
import { supabase, isSupabaseConfigured } from './client';
import { MockCommunityService } from '../mock/MockCommunityService';
import { escapeLikeLiteral, isUuid } from './query';

export class SupabaseCommunityService implements ICommunityService {
  private fallbackMock = new MockCommunityService();

  async getCommunities(category?: string): Promise<Community[]> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getCommunities(category);
    }

    const { data: { user } } = await supabase.auth.getUser();

    let query = supabase.from('communities').select(`
      *,
      community_members (user_id)
    `);

    if (category && category !== 'All Categories' && category !== 'All') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((d: any) => {
      const isMember = user
        ? (d.community_members || []).some((m: any) => m.user_id === user.id)
        : false;

      return {
        id: d.id,
        name: d.name,
        slug: d.slug,
        description: d.description,
        avatar: d.avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80',
        coverImage: d.cover_image || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
        memberCount: d.member_count ?? 0,
        isMember,
        isPrivate: d.is_private,
        category: d.category,
        rules: Array.isArray(d.rules) ? d.rules : [],
        moderators: [],
        createdAt: d.created_at,
      };
    });
  }

  async getCommunityBySlug(slug: string): Promise<Community | null> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.getCommunityBySlug(slug);
    }

    const { data: { user } } = await supabase.auth.getUser();

    const selectCommunity = () => supabase
      .from('communities')
      .select(`*, community_members (user_id)`);

    const slugResult = await selectCommunity().eq('slug', slug).maybeSingle();
    if (slugResult.error) throw new Error(slugResult.error.message);
    let data = slugResult.data;

    if (!data && isUuid(slug)) {
      const idResult = await selectCommunity().eq('id', slug).maybeSingle();
      if (idResult.error) throw new Error(idResult.error.message);
      data = idResult.data;
    }
    if (!data) return null;

    const isMember = user
      ? (data.community_members || []).some((m: any) => m.user_id === user.id)
      : false;

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      avatar: data.avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80',
      coverImage: data.cover_image || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
      memberCount: data.member_count ?? 0,
      isMember,
      isPrivate: data.is_private,
      category: data.category,
      rules: Array.isArray(data.rules) ? data.rules : [],
      moderators: [],
      createdAt: data.created_at,
    };
  }

  async toggleMembership(communityId: string): Promise<{ isMember: boolean; memberCount: number }> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.toggleMembership(communityId);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const { data: existing } = await supabase
      .from('community_members')
      .select('*')
      .eq('community_id', communityId)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', communityId)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from('community_members')
        .insert({ community_id: communityId, user_id: user.id });
      if (error) throw new Error(error.message);
    }

    const updated = await this.getCommunityBySlug(communityId);
    return {
      isMember: !existing,
      memberCount: updated?.memberCount ?? 0,
    };
  }

  async createCommunity(dto: CreateCommunityDTO): Promise<Community> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.createCommunity(dto);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { data, error } = await supabase
      .from('communities')
      .insert({
        name: dto.name,
        slug: slug || `comm_${Date.now()}`,
        description: dto.description,
        category: dto.category,
        avatar: dto.avatar,
        cover_image: dto.coverImage,
        is_private: dto.isPrivate || false,
        rules: dto.rules || [],
        created_by: user.id,
        member_count: 0,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    // Add creator as admin member
    const { error: membershipError } = await supabase.from('community_members').insert({
      community_id: data.id,
      user_id: user.id,
      role: 'admin',
    });
    if (membershipError) {
      await supabase.from('communities').delete().eq('id', data.id);
      throw new Error(`Community was created but its owner membership failed: ${membershipError.message}`);
    }

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      avatar: data.avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80',
      coverImage: data.cover_image || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
      memberCount: 1,
      isMember: true,
      isPrivate: data.is_private,
      category: data.category,
      rules: data.rules || [],
      moderators: [],
      createdAt: data.created_at,
    };
  }

  async searchCommunities(query: string): Promise<Community[]> {
    if (!isSupabaseConfigured()) {
      return this.fallbackMock.searchCommunities(query);
    }

    const q = query.trim();
    if (!q) return [];

    const pattern = `%${escapeLikeLiteral(q)}%`;
    const searches = await Promise.all([
      supabase.from('communities').select('*').ilike('name', pattern).limit(20),
      supabase.from('communities').select('*').ilike('description', pattern).limit(20),
      supabase.from('communities').select('*').ilike('category', pattern).limit(20),
    ]);
    const failedSearch = searches.find((result) => result.error);
    if (failedSearch?.error) throw new Error(failedSearch.error.message);
    const uniqueCommunities = new Map<string, NonNullable<(typeof searches)[number]['data']>[number]>();
    searches.forEach(({ data }) => (data || []).forEach((community) => uniqueCommunities.set(community.id, community)));
    const data = Array.from(uniqueCommunities.values());

    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      description: d.description,
      avatar: d.avatar,
      coverImage: d.cover_image,
      memberCount: d.member_count ?? 0,
      isMember: false,
      isPrivate: d.is_private,
      category: d.category,
      rules: d.rules || [],
      moderators: [],
      createdAt: d.created_at,
    }));
  }
}
