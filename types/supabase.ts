export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          email: string | null
          avatar_url: string | null
          bio: string | null
          account_type: string | null
          gender: string | null
          anonymous_room_name: string | null
          created_at: string | null
          updated_at: string | null
          public_key: string | null
          is_active: boolean | null
          name: string | null
        }
        Insert: {
          id: string
          username?: string | null
          email?: string | null
          avatar_url?: string | null
          bio?: string | null
          account_type?: string | null
          gender?: string | null
          anonymous_room_name?: string | null
          created_at?: string | null
          updated_at?: string | null
          public_key?: string | null
          is_active?: boolean | null
          name?: string | null
        }
        Update: {
          id?: string
          username?: string | null
          email?: string | null
          avatar_url?: string | null
          bio?: string | null
          account_type?: string | null
          gender?: string | null
          anonymous_room_name?: string | null
          created_at?: string | null
          updated_at?: string | null
          public_key?: string | null
          is_active?: boolean | null
          name?: string | null
        }
      }
      posts: {
        Row: {
          id: string
          user_id: string
          caption: string | null
          image_urls: string[]
          created_at: string
          likes_count: number
          comments_count: number
          bookmarks_count: number
          hashtags: string[] | null
          genre: string | null
          tagged_users: string[] | null
          collaborators: string[] | null
        }
        Insert: {
          id?: string
          user_id: string
          caption?: string | null
          image_urls: string[]
          created_at?: string
          likes_count?: number
          comments_count?: number
          bookmarks_count?: number
          hashtags?: string[] | null
          genre?: string | null
          tagged_users?: string[] | null
          collaborators?: string[] | null
        }
        Update: {
          id?: string
          user_id?: string
          caption?: string | null
          image_urls?: string[]
          created_at?: string
          likes_count?: number
          comments_count?: number
          bookmarks_count?: number
          hashtags?: string[] | null
          genre?: string | null
          tagged_users?: string[] | null
          collaborators?: string[] | null
        }
      }
      reels: {
        Row: {
          id: string
          user_id: string
          video_url: string
          thumbnail_url: string
          caption: string | null
          music: string | null
          created_at: string
          likes_count: number
          comments_count: number
          views_count: number
          bookmarks_count: number
          hashtags: string[] | null
          genre: string | null
          tagged_users: string[] | null
          collaboration_users: string[] | null
        }
        Insert: {
          id?: string
          user_id: string
          video_url: string
          thumbnail_url: string
          caption?: string | null
          music?: string | null
          created_at?: string
          likes_count?: number
          comments_count?: number
          views_count?: number
          bookmarks_count?: number
          hashtags?: string[] | null
          genre?: string | null
          tagged_users?: string[] | null
          collaboration_users?: string[] | null
        }
        Update: {
          id?: string
          user_id?: string
          video_url?: string
          thumbnail_url?: string
          caption?: string | null
          music?: string | null
          created_at?: string
          likes_count?: number
          comments_count?: number
          views_count?: number
          bookmarks_count?: number
          hashtags?: string[] | null
          genre?: string | null
          tagged_users?: string[] | null
          collaboration_users?: string[] | null
        }
      }
      stories: {
        Row: {
          id: string
          user_id: string
          image_url: string | null
          video_url: string | null
          caption: string | null
          created_at: string
          expires_at: string
          viewed_by: string[]
          is_active: boolean
          story_order: number
          duration: number
          story_type: string
          music_url: string | null
          thumbnail_url: string | null
        }
        Insert: {
          id?: string
          user_id: string
          image_url?: string | null
          video_url?: string | null
          caption?: string | null
          created_at?: string
          expires_at: string
          viewed_by?: string[]
          is_active?: boolean
          story_order?: number
          duration?: number
          story_type?: string
          music_url?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          image_url?: string | null
          video_url?: string | null
          caption?: string | null
          created_at?: string
          expires_at?: string
          viewed_by?: string[]
          is_active?: boolean
          story_order?: number
          duration?: number
          story_type?: string
          music_url?: string | null
          thumbnail_url?: string | null
        }
      }
      follows: {
        Row: {
          id: string
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          id?: string
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          id?: string
          follower_id?: string
          following_id?: string
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string
          content: string
          message_type: string
          is_read: boolean
          status: string
          created_at: string
          updated_at: string
          reply_to_id: string | null
          shared_post_id: string | null
          shared_reel_id: string | null
          reactions: Json | null
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id: string
          content: string
          message_type?: string
          is_read?: boolean
          status?: string
          created_at?: string
          updated_at?: string
          reply_to_id?: string | null
          shared_post_id?: string | null
          shared_reel_id?: string | null
          reactions?: Json | null
        }
        Update: {
          id?: string
          sender_id?: string
          receiver_id?: string
          content?: string
          message_type?: string
          is_read?: boolean
          status?: string
          created_at?: string
          updated_at?: string
          reply_to_id?: string | null
          shared_post_id?: string | null
          shared_reel_id?: string | null
          reactions?: Json | null
        }
      }
      likes: {
        Row: {
          id: string
          user_id: string
          post_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          post_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          post_id?: string
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          recipient_id: string
          sender_id: string
          type: string
          content: string | null
          is_read: boolean
          created_at: string
          post_id: string | null
          reel_id: string | null
        }
        Insert: {
          id?: string
          recipient_id: string
          sender_id: string
          type: string
          content?: string | null
          is_read?: boolean
          created_at?: string
          post_id?: string | null
          reel_id?: string | null
        }
        Update: {
          id?: string
          recipient_id?: string
          sender_id?: string
          type?: string
          content?: string | null
          is_read?: boolean
          created_at?: string
          post_id?: string | null
          reel_id?: string | null
        }
      }
      story_views: {
        Row: {
          id: string
          story_id: string
          viewer_id: string
          view_duration: number
          completed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          story_id: string
          viewer_id: string
          view_duration?: number
          completed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          story_id?: string
          viewer_id?: string
          view_duration?: number
          completed?: boolean
          created_at?: string
        }
      }
      bookmarks: {
        Row: {
          id: string
          user_id: string
          post_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          post_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          post_id?: string
          created_at?: string | null
        }
      }
      comments: {
        Row: {
          id: string
          user_id: string
          post_id: string
          content: string
          created_at: string | null
          likes_count: number | null
          parent_id: string | null
          parent_comment_id: string | null
          replies_count: number | null
          edited_at: string | null
          is_edited: boolean | null
          is_pinned: boolean | null
          pinned_at: string | null
          pinned_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          post_id: string
          content: string
          created_at?: string | null
          likes_count?: number | null
          parent_id?: string | null
          parent_comment_id?: string | null
          replies_count?: number | null
          edited_at?: string | null
          is_edited?: boolean | null
          is_pinned?: boolean | null
          pinned_at?: string | null
          pinned_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          post_id?: string
          content?: string
          created_at?: string | null
          likes_count?: number | null
          parent_id?: string | null
          parent_comment_id?: string | null
          replies_count?: number | null
          edited_at?: string | null
          is_edited?: boolean | null
          is_pinned?: boolean | null
          pinned_at?: string | null
          pinned_by?: string | null
        }
      }
      reel_comments: {
        Row: {
          id: string
          user_id: string
          reel_id: string
          content: string
          created_at: string | null
          likes_count: number | null
          parent_comment_id: string | null
          replies_count: number | null
          edited_at: string | null
          is_edited: boolean | null
          is_pinned: boolean | null
          pinned_at: string | null
          pinned_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          reel_id: string
          content: string
          created_at?: string | null
          likes_count?: number | null
          parent_comment_id?: string | null
          replies_count?: number | null
          edited_at?: string | null
          is_edited?: boolean | null
          is_pinned?: boolean | null
          pinned_at?: string | null
          pinned_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          reel_id?: string
          content?: string
          created_at?: string | null
          likes_count?: number | null
          parent_comment_id?: string | null
          replies_count?: number | null
          edited_at?: string | null
          is_edited?: boolean | null
          is_pinned?: boolean | null
          pinned_at?: string | null
          pinned_by?: string | null
        }
      }
      reel_likes: {
        Row: {
          id: string
          user_id: string
          reel_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          reel_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          reel_id?: string
          created_at?: string
        }
      }
      comment_likes: {
        Row: {
          id: string
          comment_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          comment_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          comment_id?: string
          user_id?: string
          created_at?: string
        }
      }
      reel_comment_likes: {
        Row: {
          id: string
          comment_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          comment_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          comment_id?: string
          user_id?: string
          created_at?: string
        }
      }
      reel_views: {
        Row: {
          id: string
          user_id: string
          reel_id: string
          duration: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          reel_id: string
          duration: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          reel_id?: string
          duration?: number
          created_at?: string
        }
      }
      reel_bookmarks: {
        Row: {
          id: string
          user_id: string
          reel_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          reel_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          reel_id?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_stories_feed_enhanced: {
        Args: { limit_param: number }
        Returns: {
          user_id: string
          username: string
          avatar_url: string | null
          story_count: number
          latest_story_time: string
          has_unviewed: boolean
          stories: Json
        }[]
      }
      get_user_stories_enhanced: {
        Args: { user_id_param: string }
        Returns: {
          id: string
          user_id: string
          image_url: string
          caption: string | null
          created_at: string
          expires_at: string
          story_order: number
          duration: number
          story_type: string
          is_viewed: boolean
        }[]
      }
      mark_story_viewed: {
        Args: { story_id_param: string; view_duration_param?: number }
        Returns: boolean
      }
      cleanup_expired_stories: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      create_story_enhanced: {
        Args: {
          image_url_param: string
          caption_param?: string
          duration_param?: number
          story_type_param?: string
        }
        Returns: string
      }
      get_user_followers: {
        Args: { user_id_param: string; limit_param?: number }
        Returns: {
          id: string
          username: string
          avatar_url: string | null
          is_following: boolean
        }[]
      }
      get_user_following: {
        Args: { user_id_param: string; limit_param?: number }
        Returns: {
          id: string
          username: string
          avatar_url: string | null
          is_following: boolean
        }[]
      }

      start_user_session: {
        Args: {
          p_user_id: string
          p_device_info?: any
        }
        Returns: string
      }
      track_post_view: {
        Args: {
          p_user_id: string
          p_post_id: string
          p_session_id?: string
        }
        Returns: void
      }
      get_smart_feed_for_user: {
        Args: {
          p_user_id: string
          p_session_id?: string
          p_limit?: number
          p_offset?: number
          p_exclude_viewed_twice?: boolean
          p_respect_24h_cooldown?: boolean
        }
        Returns: {
          id: string
          caption: string
          image_urls: string[]
          user_id: string
          created_at: string
          likes_count: number
          comments_count: number
          bookmarks_count: number
          username: string
          avatar_url: string
          user_view_count: number
          last_viewed_at: string | null
        }[]
      }
      toggle_reel_like: {
        Args: {
          p_reel_id: string
          p_user_id: string
          p_is_liked?: boolean
        }
        Returns: {
          is_liked: boolean
          likes_count: number
        }[]
      }
      toggle_comment_like: {
        Args: {
          p_comment_id: string
          p_user_id: string
          p_is_liked: boolean
        }
        Returns: {
          is_liked: boolean
          likes_count: number
        }[]
      }
      get_reel_likes: {
        Args: {
          reel_id_param: string
          limit_param?: number
        }
        Returns: {
          id: string
          username: string
          avatar_url: string | null
        }[]
      }
      get_post_likes: {
        Args: {
          post_id_param: string
          limit_param?: number
        }
        Returns: {
          id: string
          username: string
          avatar_url: string | null
        }[]
      }
      lightning_toggle_like_v3: {
        Args: {
          post_id_param: string
          user_id_param: string
        }
        Returns: {
          is_liked: boolean
          likes_count: number
        }[]
      }
      lightning_toggle_like_v4: {
        Args: {
          post_id_param: string
          user_id_param: string
        }
        Returns: {
          is_liked: boolean
          likes_count: number
        }[]
      }
      update_comment_content: {
        Args: {
          comment_id_param: string;
          new_content: string;
          new_mentions: { user_id: string; username: string }[];
          table_name: string;
        };
        Returns: any;
      }
      toggle_comment_pin: {
        Args: {
          comment_id_param: string;
          entity_id_param: string;
          entity_type: "post" | "reel";
        };
        Returns: {
          is_pinned: boolean;
          pinned_at: string | null;
          pinned_by: string | null;
        };
      }
      get_comment_like_status: {
        Args: {
          entity_type: "post" | "reel";
          comment_ids: string[];
          user_id_param: string;
        };
        Returns: {
          comment_id: string;
          is_liked: boolean;
          likes_count: number;
        }[];
      }
      get_comments_enhanced: {
        Args: {
          entity_type: "post" | "reel";
          entity_id: string;
        };
        Returns: any[];
      }
      get_comments_optimized: {
        Args: {
          entity_type: "post" | "reel";
          entity_id: string;
        };
        Returns: any[];
      }
      get_user_conversations: {
        Args: {
          user_id_param: string;
          limit_param: number;
        };
        Returns: any[];
      }
      search_users_for_sharing: {
        Args: {
          user_id_param: string;
          limit_param: number;
        };
        Returns: any[];
      }

      lightning_toggle_bookmark_v3: {
        Args: {
          post_id_param: string;
          user_id_param: string;
        };
        Returns: boolean;
      }
      // Leaderboard functions
      get_current_leaderboard_period: {
        Args: Record<PropertyKey, never>;
        Returns: void;
      }
      get_current_leaderboard: {
        Args: Record<PropertyKey, never>;
        Returns: {
          rank_position: number;
          total_points: number;
          user_id: string;
          username: string;
          avatar_url: string | null;
        }[];
      }
      get_user_leaderboard_stats: {
        Args: { user_id_param: string };
        Returns: {
          rank_position: number;
          total_points: number;
          user_id: string;
          username: string;
          avatar_url: string | null;
        }[];
      }
      add_engagement_points: {
        Args: {
          user_id_param: string;
          points_param: number;
          action_type_param: string;
        };
        Returns: void;
      }
      complete_leaderboard_period: {
        Args: Record<PropertyKey, never>;
        Returns: void;
      }
      // Notification functions
      test_notification_system: {
        Args: {
          user_id_param?: string;
          test_type?: string;
        };
        Returns: any;
      }
      send_notification: {
        Args: {
          user_id_param: string;
          title_param: string;
          body_param: string;
          data_param?: any;
        };
        Returns: any;
      }
      update_expo_token: {
        Args: {
          user_id_param: string;
          expo_token_param: string;
        };
        Returns: void;
      }
      should_send_notification: {
        Args: {
          user_id_param: string;
          notification_type_param: string;
        };
        Returns: boolean;
      }
      // Utility functions
      exec_sql: {
        Args: { sql: string };
        Returns: any;
      }
      track_reel_view: {
        Args: {
          reel_id_param: string;
          user_id_param: string;
        };
        Returns: void;
      }
      get_reel_analytics: {
        Args: {
          reel_id_param: string;
        };
        Returns: any;
      }
    }
    Enums: {
      gender_enum: 'male' | 'female' | 'other'
      account_type: 'personal' | 'creator' | 'business'
    }
  }
}
