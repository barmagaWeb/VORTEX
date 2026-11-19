import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return (
    typeof supabaseUrl === 'string' &&
    supabaseUrl.trim() !== '' &&
    !supabaseUrl.toLowerCase().includes('placeholder') &&
    !supabaseUrl.includes('your-project-id') &&
    /^https:\/\//i.test(supabaseUrl) &&
    typeof supabaseAnonKey === 'string' &&
    supabaseAnonKey.trim() !== '' &&
    !supabaseAnonKey.toLowerCase().includes('placeholder') &&
    !supabaseAnonKey.includes('...') &&
    supabaseAnonKey.length > 30
  );
};

// A production configuration error is rendered by App's configuration gate.
// Avoid throwing during module evaluation, which otherwise causes a blank page.
// The client uses a non-functional placeholder when credentials are absent; the app configuration gate must prevent authenticated operations.
export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured() ? supabaseUrl : 'https://placeholder-vortex.supabase.co',
  isSupabaseConfigured() ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
