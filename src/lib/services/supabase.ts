/**
 * Supabase Client Service
 * Simple SvelteKit-friendly client using public static env vars
 */

import type { Database } from '$lib/types/database';

import { createClient } from '@supabase/supabase-js';
import {
  VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY
} from '$env/static/public';

// Create a single shared client instance
export const supabase = createClient<Database>(
  VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

// Optional convenience flag
export const isSupabaseConfigured = Boolean(
  VITE_SUPABASE_URL && 
VITE_SUPABASE_ANON_KEY
);

/**
 * Get or create anonymous session ID
 * Useful for lightweight analytics / guest flows
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') {
    return 'ssr-placeholder';
  }

  const STORAGE_KEY = 'knowledge-arena-session';
  let sessionId = localStorage.getItem(STORAGE_KEY);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, sessionId);
  }

  return sessionId;
}
