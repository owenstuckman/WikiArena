/**
 * Supabase Client - Following official SvelteKit quickstart
 * https://supabase.com/docs/guides/getting-started/quickstarts/sveltekit
 * 
 * Uses dynamic env to gracefully handle missing credentials
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import type { Database } from '$lib/types/database';

// Get environment variables with fallbacks
const supabaseUrl = env.PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = env.PUBLIC_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('http')
);

// Create the Supabase client (or a mock if not configured)
export const supabase: SupabaseClient<Database> = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : createMockClient() as unknown as SupabaseClient<Database>;

/**
 * Get or create anonymous session ID for vote tracking
 */
export function getSessionId(): string {
  if (!browser) {
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

/**
 * Create a mock client for when Supabase isn't configured
 */
function createMockClient() {
  const mockResponse = { data: null, error: { message: 'Supabase not configured' } };
  const mockArrayResponse = { data: [], error: null };

  const chainable = (): any => {
    const builder: any = {
      select: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      upsert: () => builder,
      eq: () => builder,
      neq: () => builder,
      gt: () => builder,
      gte: () => builder,
      lt: () => builder,
      lte: () => builder,
      like: () => builder,
      ilike: () => builder,
      is: () => builder,
      in: () => builder,
      or: () => builder,
      and: () => builder,
      not: () => builder,
      filter: () => builder,
      order: () => builder,
      limit: () => builder,
      range: () => builder,
      single: () => Promise.resolve(mockResponse),
      maybeSingle: () => Promise.resolve(mockResponse),
      then: (resolve: any) => Promise.resolve(mockArrayResponse).then(resolve),
    };
    return builder;
  };

  return {
    from: () => chainable(),
    rpc: () => Promise.resolve({ data: [], error: null }),
    channel: () => ({
      on: function() { return this; },
      subscribe: () => ({ unsubscribe: () => {} }),
    }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: {}, error: { message: 'Not configured' } }),
      signUp: () => Promise.resolve({ data: {}, error: { message: 'Not configured' } }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  };
}

// Log status in browser console
if (browser && !isSupabaseConfigured) {
  console.info(
    '%c⚠️ Knowledge Arena - Demo Mode',
    'color: #f59e0b; font-weight: bold;'
  );
  console.info(
    'Supabase not configured. Create .env file with:\n' +
    'PUBLIC_SUPABASE_URL=https://your-project.supabase.co\n' +
    'PUBLIC_SUPABASE_ANON_KEY=your-anon-key'
  );
}

