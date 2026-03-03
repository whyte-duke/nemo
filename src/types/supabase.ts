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
      profiles: {
        Row: {
          id: string;                         // UUID — référence auth.users(id)
          display_name: string | null;
          avatar_url: string | null;
          debrid_api_key: string | null;
          debrid_type: "alldebrid" | "realdebrid" | null;
          preferred_quality: string;
          preferred_language: string;
          streaming_services: string[] | null;
          show_paid_options: boolean;
          phone_number: string | null;
          personal_jellyfin_url: string | null;
          personal_jellyfin_api_key: string | null;
          personal_jellyfin_server_id: string | null; // FK → jellyfin_servers.id
          webhook_token: string | null;
          last_library_sync_at: string | null;
          role: "free" | "sources" | "vip" | "admin";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          debrid_api_key?: string | null;
          debrid_type?: "alldebrid" | "realdebrid" | null;
          preferred_quality?: string;
          preferred_language?: string;
          streaming_services?: string[] | null;
          show_paid_options?: boolean;
          phone_number?: string | null;
          personal_jellyfin_url?: string | null;
          personal_jellyfin_api_key?: string | null;
          personal_jellyfin_server_id?: string | null;
          webhook_token?: string | null;
          last_library_sync_at?: string | null;
          role?: "free" | "sources" | "vip" | "admin";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      jellyfin_servers: {
        Row: {
          id: string;
          url: string;
          server_name: string | null;
          item_count: number;
          synced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          url: string;
          server_name?: string | null;
          item_count?: number;
          synced_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["jellyfin_servers"]["Insert"]>;
      };
      jellyfin_server_items: {
        Row: {
          id: string;
          server_id: string;
          jellyfin_item_id: string;
          tmdb_id: string;
          media_type: "movie" | "tv";
          synced_at: string;
        };
        Insert: {
          id?: string;
          server_id: string;
          jellyfin_item_id: string;
          tmdb_id: string;
          media_type: "movie" | "tv";
          synced_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["jellyfin_server_items"]["Insert"]>;
      };
      watch_history: {
        Row: {
          id: string;
          user_id: string;
          tmdb_id: number;
          media_type: "movie" | "tv";
          progress: number;
          duration: number | null;
          season_number: number | null;
          episode_number: number | null;
          last_watched_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tmdb_id: number;
          media_type: "movie" | "tv";
          progress?: number;
          duration?: number | null;
          season_number?: number | null;
          episode_number?: number | null;
          last_watched_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["watch_history"]["Insert"]>;
      };
      external_watch_history: {
        Row: {
          id: string;
          user_id: string;
          source: string;
          tmdb_id: number | null;
          imdb_id: string | null;
          media_type: string;
          title: string;
          watched_at: string | null;
          user_rating: number | null;
          review: string | null;
          raw_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source: string;
          tmdb_id?: number | null;
          imdb_id?: string | null;
          media_type: string;
          title: string;
          watched_at?: string | null;
          user_rating?: number | null;
          review?: string | null;
          raw_data?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["external_watch_history"]["Insert"]>;
      };
      lists: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          is_public: boolean;
          icon: string | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          is_public?: boolean;
          icon?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lists"]["Insert"]>;
      };
      list_members: {
        Row: {
          id: string;
          list_id: string;
          user_id: string;
          role: "owner" | "member";
          joined_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          user_id: string;
          role?: "owner" | "member";
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["list_members"]["Insert"]>;
      };
      friendships: {
        Row: {
          id: string;
          user_id: string;
          friend_id: string;
          source: "invite" | "manual";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          friend_id: string;
          source?: "invite" | "manual";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["friendships"]["Insert"]>;
      };
      friend_requests: {
        Row: {
          id: string;
          from_user: string;
          to_user: string;
          status: "pending" | "accepted" | "declined";
          created_at: string;
        };
        Insert: {
          id?: string;
          from_user: string;
          to_user: string;
          status?: "pending" | "accepted" | "declined";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["friend_requests"]["Insert"]>;
      };
      list_items: {
        Row: {
          id: string;
          list_id: string;
          tmdb_id: number;
          media_type: "movie" | "tv";
          added_at: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          list_id: string;
          tmdb_id: number;
          media_type: "movie" | "tv";
          added_at?: string;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["list_items"]["Insert"]>;
      };
      interactions: {
        Row: {
          id: string;
          user_id: string;
          tmdb_id: number;
          media_type: "movie" | "tv";
          type: "like" | "dislike";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tmdb_id: number;
          media_type: "movie" | "tv";
          type: "like" | "dislike";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["interactions"]["Insert"]>;
      };
      download_queue: {
        Row: {
          id: string;
          user_id: string;
          user_name: string;
          media_title: string;
          media_type: "movie" | "tv";
          tmdb_id: number | null;
          season_number: number | null;
          episode_number: number | null;
          quality: string | null;
          audio_languages: string[];
          sub_languages: string[];
          selected_indices: number[];
          destination_path: string;
          source_urls: string[];
          is_batch: boolean;
          status: "pending" | "downloading" | "completed" | "error";
          error_log: string | null;
          file_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          user_name: string;
          media_title: string;
          media_type: "movie" | "tv";
          tmdb_id?: number | null;
          season_number?: number | null;
          episode_number?: number | null;
          quality?: string | null;
          audio_languages?: string[];
          sub_languages?: string[];
          selected_indices?: number[];
          destination_path: string;
          source_urls: string[];
          is_batch?: boolean;
          status?: "pending" | "downloading" | "completed" | "error";
          error_log?: string | null;
          file_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          user_name?: string;
          media_title?: string;
          media_type?: "movie" | "tv";
          tmdb_id?: number | null;
          season_number?: number | null;
          episode_number?: number | null;
          quality?: string | null;
          audio_languages?: string[];
          sub_languages?: string[];
          selected_indices?: number[];
          destination_path?: string;
          source_urls?: string[];
          is_batch?: boolean;
          status?: "pending" | "downloading" | "completed" | "error";
          error_log?: string | null;
          file_path?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type JellyfinServer = Database["public"]["Tables"]["jellyfin_servers"]["Row"];
export type JellyfinServerItem = Database["public"]["Tables"]["jellyfin_server_items"]["Row"];
export type WatchHistory = Database["public"]["Tables"]["watch_history"]["Row"];
export type ExternalWatchHistory = Database["public"]["Tables"]["external_watch_history"]["Row"];
export type MediaList = Database["public"]["Tables"]["lists"]["Row"];
export type ListItem = Database["public"]["Tables"]["list_items"]["Row"];
export type ListMember = Database["public"]["Tables"]["list_members"]["Row"];
export type Interaction = Database["public"]["Tables"]["interactions"]["Row"];
export type DownloadQueue = Database["public"]["Tables"]["download_queue"]["Row"];
export type Friendship = Database["public"]["Tables"]["friendships"]["Row"];
export type FriendRequest = Database["public"]["Tables"]["friend_requests"]["Row"];

export type PublicProfile = Pick<Profile, "id" | "display_name" | "avatar_url" | "role">;

export type ListWithMembers = MediaList & {
  members: Array<ListMember & { profile: PublicProfile }>;
  item_count: number;
};

export type FriendWithProfile = Friendship & {
  profile: PublicProfile;
  films_watched: number;
};

export type ActivityEvent = {
  type: "watched" | "liked" | "disliked" | "added_to_list";
  user: PublicProfile;
  media?: { tmdb_id: number; title: string; poster_path: string | null; media_type: "movie" | "tv" };
  list?: { id: string; name: string; icon: string | null };
  timestamp: string;
};
