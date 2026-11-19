import { ICommunityService, CreateCommunityDTO } from '../interfaces/ICommunityService';
import { Community } from '../../types';
import { MOCK_COMMUNITIES, CURRENT_USER } from '../../constants/mockData';
import { storage } from './storage';

const STORAGE_KEY_COMMUNITIES = 'vortex_communities_store';

export class MockCommunityService implements ICommunityService {
  private getCommunitiesStore(): Community[] {
    return storage.get<Community[]>(STORAGE_KEY_COMMUNITIES, MOCK_COMMUNITIES);
  }

  private saveCommunitiesStore(communities: Community[]): void {
    storage.set(STORAGE_KEY_COMMUNITIES, communities);
  }

  async getCommunities(category?: string): Promise<Community[]> {
    const list = this.getCommunitiesStore();
    if (category && category !== 'All Categories') {
      return list.filter((c) => c.category.toLowerCase() === category.toLowerCase());
    }
    return list;
  }

  async getCommunityBySlug(slug: string): Promise<Community | null> {
    const list = this.getCommunitiesStore();
    return list.find((c) => c.slug === slug || c.id === slug) || null;
  }

  async toggleMembership(communityId: string): Promise<{ isMember: boolean; memberCount: number }> {
    const list = this.getCommunitiesStore();
    const comm = list.find((c) => c.id === communityId);
    if (!comm) throw new Error('Community not found');

    const isMember = !comm.isMember;
    comm.isMember = isMember;
    comm.memberCount = isMember ? comm.memberCount + 1 : Math.max(1, comm.memberCount - 1);
    this.saveCommunitiesStore(list);

    return { isMember, memberCount: comm.memberCount };
  }

  async createCommunity(dto: CreateCommunityDTO): Promise<Community> {
    const list = this.getCommunitiesStore();
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const newCommunity: Community = {
      id: `comm_${Date.now()}`,
      name: dto.name,
      slug: slug || `community-${Date.now()}`,
      description: dto.description,
      category: dto.category,
      avatar: dto.avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80',
      coverImage: dto.coverImage || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
      memberCount: 1,
      isMember: true,
      isPrivate: dto.isPrivate || false,
      rules: dto.rules && dto.rules.length > 0 ? dto.rules : [
        'Respect all members and keep discussions constructive.',
        'No spam, unauthorized advertising, or harassment.',
      ],
      moderators: [CURRENT_USER],
      createdAt: new Date().toISOString().split('T')[0],
    };

    list.unshift(newCommunity);
    this.saveCommunitiesStore(list);
    return newCommunity;
  }

  async searchCommunities(query: string): Promise<Community[]> {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const list = this.getCommunitiesStore();
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  }
}
