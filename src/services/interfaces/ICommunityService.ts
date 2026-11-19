import { Community } from '../../types';

export interface CreateCommunityDTO {
  name: string;
  description: string;
  category: string;
  avatar?: string;
  coverImage?: string;
  isPrivate?: boolean;
  rules?: string[];
}

export interface ICommunityService {
  /**
   * Fetches list of all communities, optionally filtered by category.
   * Future Supabase hook: supabase.from('communities').select('*')
   */
  getCommunities(category?: string): Promise<Community[]>;

  /**
   * Fetches community detail by slug or id.
   */
  getCommunityBySlug(slug: string): Promise<Community | null>;

  /**
   * Joins or leaves a community.
   */
  toggleMembership(communityId: string): Promise<{ isMember: boolean; memberCount: number }>;

  /**
   * Creates a new community.
   */
  createCommunity(dto: CreateCommunityDTO): Promise<Community>;

  /**
   * Searches communities by name or topic.
   */
  searchCommunities(query: string): Promise<Community[]>;
}
