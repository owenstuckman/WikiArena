import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase, isSupabaseConfigured, getSessionId } from '$lib/supabaseClient';
import type { UserPreference, Vote, BlendConfig } from '$lib/types/database';

interface UserState {
  userId: string | null;
  sessionId: string;
  isAuthenticated: boolean;
  preferences: UserPreference[];
  voteHistory: Vote[];
  blendConfigs: BlendConfig[];
  totalVotes: number;
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  userId: null,
  sessionId: '',
  isAuthenticated: false,
  preferences: [],
  voteHistory: [],
  blendConfigs: [],
  totalVotes: 0,
  loading: false,
  error: null,
};

function createUserStore() {
  const { subscribe, set, update } = writable<UserState>(initialState);

  return {
    subscribe,

    /**
     * Initialize user state - check for existing session
     */
    async init() {
      if (!browser) return;
      
      const sessionId = getSessionId();
      update(s => ({ ...s, sessionId }));

      if (!isSupabaseConfigured) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          update(s => ({
            ...s,
            userId: session.user.id,
            isAuthenticated: true,
          }));
          
          await this.loadUserData();
        }
      } catch (error) {
        console.error('Failed to initialize user:', error);
      }
    },

    /**
     * Load user preferences and vote history
     */
    async loadUserData() {
      if (!isSupabaseConfigured || !browser) return;
      
      update(s => ({ ...s, loading: true }));

      try {
        const sessionId = getSessionId();
        
        const { data: votes, error: votesError } = await supabase
          .from('votes')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (votesError) throw votesError;

        update(s => ({
          ...s,
          voteHistory: votes || [],
          totalVotes: votes?.length || 0,
          loading: false,
        }));

      } catch (error) {
        update(s => ({
          ...s,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load user data',
        }));
      }
    },

    /**
     * Sign in with email
     */
    async signIn(email: string, password: string) {
      if (!isSupabaseConfigured) {
        update(s => ({ ...s, error: 'Supabase not configured' }));
        return { error: 'Supabase not configured' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        update(s => ({ ...s, error: error.message }));
        return { error: error.message };
      }

      if (data.user) {
        update(s => ({
          ...s,
          userId: data.user!.id,
          isAuthenticated: true,
          error: null,
        }));
        await this.loadUserData();
      }

      return { error: null };
    },

    /**
     * Sign up with email
     */
    async signUp(email: string, password: string) {
      if (!isSupabaseConfigured) {
        update(s => ({ ...s, error: 'Supabase not configured' }));
        return { error: 'Supabase not configured' };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        update(s => ({ ...s, error: error.message }));
        return { error: error.message };
      }

      return { error: null, needsConfirmation: !data.session };
    },

    /**
     * Sign out
     */
    async signOut() {
      if (!isSupabaseConfigured) return;
      
      await supabase.auth.signOut();
      
      set({
        ...initialState,
        sessionId: browser ? getSessionId() : '',
      });
    },

    /**
     * Get current session ID
     */
    getSessionId(): string {
      return browser ? getSessionId() : '';
    },

    /**
     * Clear error
     */
    clearError() {
      update(s => ({ ...s, error: null }));
    },

    /**
     * Add a vote to history (called after voting)
     */
    addVote(vote: Vote) {
      update(s => ({
        ...s,
        voteHistory: [vote, ...s.voteHistory],
        totalVotes: s.totalVotes + 1,
      }));
    },
  };
}

export const userStore = createUserStore();

// Derived stores
export const isAuthenticated = derived(userStore, $user => $user.isAuthenticated);
export const sessionId = derived(userStore, $user => $user.sessionId);
export const totalUserVotes = derived(userStore, $user => $user.totalVotes);
