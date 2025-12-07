/**
 * Authentication Store
 * Manages user authentication state
 */

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase, isSupabaseConfigured, getSessionId } from '$lib/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  sessionId: string; // Anonymous session ID for non-logged-in users
  loading: boolean;
  initialized: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  session: null,
  sessionId: '',
  loading: true,
  initialized: false,
  error: null,
};

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(initialState);

  return {
    subscribe,

    /**
     * Initialize auth state - check for existing session
     */
    async init() {
      if (!browser) return;

      const sessionId = getSessionId();
      update(s => ({ ...s, sessionId }));

      if (!isSupabaseConfigured) {
        update(s => ({ ...s, loading: false, initialized: true }));
        return;
      }

      try {
        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        update(s => ({
          ...s,
          user: session?.user || null,
          session: session,
          loading: false,
          initialized: true,
        }));

        // Listen for auth changes
        supabase.auth.onAuthStateChange((_event, session) => {
          update(s => ({
            ...s,
            user: session?.user || null,
            session: session,
          }));
        });
      } catch (e) {
        console.error('Auth init error:', e);
        update(s => ({
          ...s,
          loading: false,
          initialized: true,
          error: e instanceof Error ? e.message : 'Failed to initialize auth',
        }));
      }
    },

    /**
     * Sign in with email and password
     */
    async signIn(email: string, password: string): Promise<{ error: string | null }> {
      if (!isSupabaseConfigured) {
        return { error: 'Database not configured' };
      }

      update(s => ({ ...s, loading: true, error: null }));

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        update(s => ({
          ...s,
          user: data.user,
          session: data.session,
          loading: false,
        }));

        return { error: null };
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Sign in failed';
        update(s => ({ ...s, loading: false, error: errorMessage }));
        return { error: errorMessage };
      }
    },

    /**
     * Sign up with email and password
     */
    async signUp(email: string, password: string): Promise<{ error: string | null; needsConfirmation: boolean }> {
      if (!isSupabaseConfigured) {
        return { error: 'Database not configured', needsConfirmation: false };
      }

      update(s => ({ ...s, loading: true, error: null }));

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        const needsConfirmation = !data.session;
        
        if (data.session) {
          update(s => ({
            ...s,
            user: data.user,
            session: data.session,
            loading: false,
          }));
        } else {
          update(s => ({ ...s, loading: false }));
        }

        return { error: null, needsConfirmation };
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Sign up failed';
        update(s => ({ ...s, loading: false, error: errorMessage }));
        return { error: errorMessage, needsConfirmation: false };
      }
    },

    /**
     * Sign out
     */
    async signOut(): Promise<void> {
      if (!isSupabaseConfigured) return;

      update(s => ({ ...s, loading: true }));

      try {
        await supabase.auth.signOut();
        update(s => ({
          ...s,
          user: null,
          session: null,
          loading: false,
        }));
      } catch (e) {
        console.error('Sign out error:', e);
        update(s => ({ ...s, loading: false }));
      }
    },

    /**
     * Reset password
     */
    async resetPassword(email: string): Promise<{ error: string | null }> {
      if (!isSupabaseConfigured) {
        return { error: 'Database not configured' };
      }

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Password reset failed' };
      }
    },

    /**
     * Clear error
     */
    clearError() {
      update(s => ({ ...s, error: null }));
    },

    /**
     * Get the current user ID or session ID for anonymous users
     */
    getEffectiveUserId(): string {
      let userId = '';
      subscribe(s => {
        userId = s.user?.id || s.sessionId;
      })();
      return userId;
    },
  };
}

export const authStore = createAuthStore();

// Derived stores for convenience
export const isAuthenticated = derived(authStore, $auth => !!$auth.user);
export const currentUser = derived(authStore, $auth => $auth.user);
export const authLoading = derived(authStore, $auth => $auth.loading);
export const authError = derived(authStore, $auth => $auth.error);
