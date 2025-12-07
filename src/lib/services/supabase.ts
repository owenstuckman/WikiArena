import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '$lib/types/database';

/**
 * Create Supabase client for browser usage
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Create Supabase client for server-side usage (load functions, actions)
 */
export function createSupabaseServerClient(
  cookies: {
    get: (key: string) => string | undefined;
    set: (key: string, value: string, options: any) => void;
    remove: (key: string, options: any) => void;
  }
) {
  return createServerClient<Database>(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(key) {
          return cookies.get(key);
        },
        set(key, value, options) {
          cookies.set(key, value, { ...options, path: '/' });
        },
        remove(key, options) {
          cookies.remove(key, { ...options, path: '/' });
        },
      },
    }
  );
}

/**
 * Get or create anonymous session ID
 * Stored in sessionStorage for anonymous vote tracking
 */
export function getSessionId(): string {
  if (!isBrowser) {
    return crypto.randomUUID();
  }
  
  const STORAGE_KEY = 'knowledge-arena-session';
  let sessionId = sessionStorage.getItem(STORAGE_KEY);
  
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(STORAGE_KEY, sessionId);
  }
  
  return sessionId;
}

/**
 * Supabase singleton for client-side usage
 */
let browserClient: ReturnType<typeof createSupabaseBrowserClient> | null = null;

export function getSupabase() {
  if (!browserClient) {
    browserClient = createSupabaseBrowserClient();
  }
  return browserClient;
}
