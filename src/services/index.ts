/**
 * VORTEX Service Registry / Locator
 * 
 * Powered by Supabase Backend Architecture:
 * - Supabase-backed services when credentials are configured
 * - No Mock-service fallback is wired in this registry; all exported services use Supabase
 * - RLS enforcement depends on applying and validating the SQL migrations
 */

import { IAuthService } from './interfaces/IAuthService';
import { IUserService } from './interfaces/IUserService';
import { IPostService } from './interfaces/IPostService';
import { IMessagingService } from './interfaces/IMessagingService';
import { INotificationService } from './interfaces/INotificationService';
import { ICommunityService } from './interfaces/ICommunityService';
import { IAdminService } from './interfaces/IAdminService';
import { IStoriesService } from './interfaces/IStoriesService';

import { SupabaseAuthService } from './supabase/SupabaseAuthService';
import { SupabaseUserService } from './supabase/SupabaseUserService';
import { SupabasePostService } from './supabase/SupabasePostService';
import { SupabaseMessagingService } from './supabase/SupabaseMessagingService';
import { SupabaseNotificationService } from './supabase/SupabaseNotificationService';
import { SupabaseCommunityService } from './supabase/SupabaseCommunityService';
import { SupabaseAdminService } from './supabase/SupabaseAdminService';
import { SupabaseStoriesService } from './supabase/SupabaseStoriesService';

export const authService: IAuthService = new SupabaseAuthService();
export const userService: IUserService = new SupabaseUserService();
export const postService: IPostService = new SupabasePostService();
export const messagingService: IMessagingService = new SupabaseMessagingService();
export const notificationService: INotificationService = new SupabaseNotificationService();
export const communityService: ICommunityService = new SupabaseCommunityService();
export const adminService: IAdminService = new SupabaseAdminService();
export const storiesService: IStoriesService = new SupabaseStoriesService();

export * from './interfaces';
export { isSupabaseConfigured, supabase } from './supabase/client';
