// Consolidated shared types for the application

export interface User {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  avatar?: string;
  bio?: string;
  followers_count?: number;
  following_count?: number;
  followersCount?: number;
  followingCount?: number;
  posts_count?: number;
  postsCount?: number;
  reels_count?: number;
  isFollowing?: boolean;
  created_at?: string;
  updated_at?: string;
  email?: string;
}

export interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  status?: 'sent' | 'delivered' | 'read';
  message_type?: 'text' | 'image' | 'shared_post' | 'shared_reel';
  reply_to_message_id?: string;
  reply_to_message?: {
    id: string;
    content: string;
    sender_id: string;
    message_type?: string;
    sender?: {
      username: string;
    };
  };
  image_url?: string;
  post_id?: string;
  reel_id?: string;
}

export interface Story {
  id: string;
  user_id: string;
  image_url: string;
  video_url?: string;
  thumbnail_url?: string;
  story_type?: 'image' | 'video';
  caption?: string;
  created_at: string;
  expires_at: string;
  viewed_by: string[];
  story_order?: number;
  duration?: number;
  user: {
    username: string;
    avatar: string;
  };
  is_viewed?: boolean;
}

export interface GroupedStory {
  user_id: string;
  user: {
    username: string;
    avatar: string;
  };
  stories: Story[];
  hasUnviewed: boolean;
  latestStory: Story;
}

export interface StoriesFeed {
  user_id: string;
  username: string;
  avatar_url: string;
  story_count: number;
  latest_story_time: string;
  has_unviewed: boolean;
  stories: Story[];
}

export interface Post {
  id: string;
  image_urls: string[];
  caption: string;
  user_id: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked?: boolean;
  is_bookmarked?: boolean;
  user: {
    id?: string;
    username: string;
    avatar_url?: string;
  };
  hashtags?: string[];
  genre?: string;
  tagged_users?: string[];
  collaborators?: string[];
  tagged_users_details?: User[];
  collaborators_details?: User[];
  likes?: { user_id: string }[];
  bookmarks?: { user_id: string }[];
  comments?: Comment[];
}

export interface Reel {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string;
  caption: string;
  music?: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  views_count?: number;
  is_liked: boolean;
  is_bookmarked?: boolean;
  user: {
    id?: string;
    username: string;
    avatar_url?: string;
  };
  comments?: ReelComment[];
}

export interface Comment {
  id: string;
  content: string;
  user_id: string;
  post_id: string;
  parent_comment_id?: string;
  created_at: string;
  likes_count: number;
  user: {
    username: string;
    avatar: string;
  };
  replies?: Comment[];
  mentions?: {
    id: string;
    username: string;
  }[];
}

export interface ReelComment {
  id: string;
  content: string;
  user_id: string;
  reel_id: string;
  parent_comment_id?: string;
  created_at: string;
  likes_count: number;
  user: {
    username: string;
    avatar: string;
  };
  replies?: ReelComment[];
  mentions?: {
    id: string;
    username: string;
  }[];
}

export interface Conversation {
  userId: string;
  username: string;
  avatar: string;
  lastMessage: string;
}

export interface SharedPostData {
  type: 'shared_post';
  post_id: string;
  post_caption: string;
  post_image: string;
  post_owner: string;
  shared_by: string;
  shared_at: string;
}

export interface SharedReelData {
  type: 'shared_reel';
  reel_id: string;
  reel_caption: string;
  reel_video_url: string;
  reel_thumbnail?: string;
  reel_owner: string;
  shared_by: string;
  shared_at: string;
}

export interface LikeUser {
  id: string;
  username: string;
  avatar_url?: string;
  full_name?: string;
}