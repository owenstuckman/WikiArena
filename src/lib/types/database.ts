/**
 * Database types for Knowledge Arena
 * Auto-generated types should be placed here after running:
 * npx supabase gen types typescript --local > src/lib/types/database.ts
 */

/**
 * Database types for Knowledge Arena
 * 
 * To regenerate types from your Supabase schema, run:
 * npx supabase gen types typescript --project-id your-project-ref > src/lib/types/database.ts
 * 
 * Or for local development:
 * npx supabase gen types typescript --local > src/lib/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      sources: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          api_endpoint: string | null;
          api_config: Json;
          logo_url: string | null;
          is_active: boolean;
          rating: number;
          rating_deviation: number;
          volatility: number;
          total_matches: number;
          total_wins: number;
          total_losses: number;
          total_ties: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          api_endpoint?: string | null;
          api_config?: Json;
          logo_url?: string | null;
          is_active?: boolean;
          rating?: number;
          rating_deviation?: number;
          volatility?: number;
          total_matches?: number;
          total_wins?: number;
          total_losses?: number;
          total_ties?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          api_endpoint?: string | null;
          api_config?: Json;
          logo_url?: string | null;
          is_active?: boolean;
          rating?: number;
          rating_deviation?: number;
          volatility?: number;
          total_matches?: number;
          total_wins?: number;
          total_losses?: number;
          total_ties?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      topics: {
        Row: {
          id: string;
          title: string;
          slug: string;
          category: string | null;
          description: string | null;
          usage_count: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          category?: string | null;
          description?: string | null;
          usage_count?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string;
          category?: string | null;
          description?: string | null;
          usage_count?: number;
          is_active?: boolean;
          created_at?: string;
        };
      };
      matches: {
        Row: {
          id: string;
          topic_id: string | null;
          topic_query: string;
          source_a_id: string;
          source_b_id: string;
          source_a_content: string | null;
          source_b_content: string | null;
          source_a_position: number;
          content_fetched_at: string | null;
          expires_at: string | null;
          status: 'active' | 'completed' | 'expired';
          created_at: string;
        };
        Insert: {
          id?: string;
          topic_id?: string | null;
          topic_query: string;
          source_a_id: string;
          source_b_id: string;
          source_a_content?: string | null;
          source_b_content?: string | null;
          source_a_position?: number;
          content_fetched_at?: string | null;
          expires_at?: string | null;
          status?: 'active' | 'completed' | 'expired';
          created_at?: string;
        };
        Update: {
          id?: string;
          topic_id?: string | null;
          topic_query?: string;
          source_a_id?: string;
          source_b_id?: string;
          source_a_content?: string | null;
          source_b_content?: string | null;
          source_a_position?: number;
          content_fetched_at?: string | null;
          expires_at?: string | null;
          status?: 'active' | 'completed' | 'expired';
          created_at?: string;
        };
      };
      votes: {
        Row: {
          id: string;
          match_id: string;
          user_id: string | null;
          session_id: string;
          winner: 'a' | 'b' | 'tie' | 'both_bad';
          source_a_rating_before: number | null;
          source_a_rating_after: number | null;
          source_b_rating_before: number | null;
          source_b_rating_after: number | null;
          time_to_vote_ms: number | null;
          device_type: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          user_id?: string | null;
          session_id: string;
          winner: 'a' | 'b' | 'tie' | 'both_bad';
          source_a_rating_before?: number | null;
          source_a_rating_after?: number | null;
          source_b_rating_before?: number | null;
          source_b_rating_after?: number | null;
          time_to_vote_ms?: number | null;
          device_type?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          user_id?: string | null;
          session_id?: string;
          winner?: 'a' | 'b' | 'tie' | 'both_bad';
          source_a_rating_before?: number | null;
          source_a_rating_after?: number | null;
          source_b_rating_before?: number | null;
          source_b_rating_after?: number | null;
          time_to_vote_ms?: number | null;
          device_type?: string | null;
          metadata?: Json;
          created_at?: string;
        };
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          source_id: string;
          preference_score: number;
          wins: number;
          losses: number;
          ties: number;
          category: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_id: string;
          preference_score?: number;
          wins?: number;
          losses?: number;
          ties?: number;
          category?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source_id?: string;
          preference_score?: number;
          wins?: number;
          losses?: number;
          ties?: number;
          category?: string | null;
          updated_at?: string;
        };
      };
      blend_configs: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          weights: Json;
          format_prompt: string | null;
          output_style: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          weights?: Json;
          format_prompt?: string | null;
          output_style?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          weights?: Json;
          format_prompt?: string | null;
          output_style?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      rating_history: {
        Row: {
          id: string;
          source_id: string;
          rating: number;
          rating_deviation: number;
          volatility: number;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          rating: number;
          rating_deviation: number;
          volatility: number;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          source_id?: string;
          rating?: number;
          rating_deviation?: number;
          volatility?: number;
          recorded_at?: string;
        };
      };
    };
    Functions: {
      get_leaderboard: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          rating: number;
          rating_deviation: number;
          total_matches: number;
          total_wins: number;
          total_losses: number;
          total_ties: number;
          win_rate: number;
        }[];
      };
      increment_topic_usage: {
        Args: { p_topic_id: string };
        Returns: void;
      };
    };
  };
}

// Convenience type aliases
export type Source = Database['public']['Tables']['sources']['Row'];
export type Topic = Database['public']['Tables']['topics']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
export type Vote = Database['public']['Tables']['votes']['Row'];
export type UserPreference = Database['public']['Tables']['user_preferences']['Row'];
export type BlendConfig = Database['public']['Tables']['blend_configs']['Row'];
export type RatingHistory = Database['public']['Tables']['rating_history']['Row'];

export type VoteWinner = 'a' | 'b' | 'tie' | 'both_bad';

// Extended types for joins
export interface MatchWithSources extends Match {
  source_a: Source;
  source_b: Source;
  topic?: Topic;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  rating: number;
  rating_deviation: number;
  total_matches: number;
  total_wins: number;
  total_losses: number;
  total_ties: number;
  win_rate: number;
}

// Arena-specific types
export interface ArenaMatch {
  id: string;
  topic: string;
  leftContent: string;
  rightContent: string;
  // Hidden until reveal
  sourceA?: Source;
  sourceB?: Source;
  sourceAPosition: number;
}

export interface VoteResult {
  vote: Vote;
  ratings: {
    sourceA: { before: number; after: number; change: number };
    sourceB: { before: number; after: number; change: number };
  };
  reveal: {
    sourceA: Source;
    sourceB: Source;
  };
}
