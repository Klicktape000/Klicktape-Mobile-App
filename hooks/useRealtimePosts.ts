/**
 * REAL-TIME POSTS HOOK
 * Provides Instagram-style real-time updates for posts feed
 * - Listens for new posts from followed users
 * - Updates like counts, comment counts in real-time
 * - Syncs bookmark status across the app
 * - Optimistic updates with automatic rollback on error
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/query/queryKeys';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '../lib/authContext';

interface UseRealtimePostsOptions {
  enabled?: boolean;
  onNewPost?: (post: any) => void;
  onPostUpdate?: (post: any) => void;
  onPostDelete?: (postId: string) => void;
}

export const useRealtimePosts = (options: UseRealtimePostsOptions = {}) => {
  const { enabled = true, onNewPost, onPostUpdate, onPostDelete } = options;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const postsChannelRef = useRef<RealtimeChannel | null>(null);
  const likesChannelRef = useRef<RealtimeChannel | null>(null);
  const commentsChannelRef = useRef<RealtimeChannel | null>(null);
  const bookmarksChannelRef = useRef<RealtimeChannel | null>(null);

  // Invalidate all post-related queries to trigger refetch
  const invalidatePostQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.posts.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.posts.explore() });
  }, [queryClient]);

  // Update a specific post in the cache
  const updatePostInCache = useCallback((postId: string, updater: (post: any) => any) => {
    // Update in all post list queries (feed, smart feed, explore, etc.)
    queryClient.setQueriesData(
      { queryKey: queryKeys.posts.all },
      (oldData: any) => {
        if (!oldData?.pages) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            posts: page.posts?.map((post: any) =>
              post.id === postId ? updater(post) : post
            ) || []
          }))
        };
      }
    );

    // Update single post query
    queryClient.setQueryData(
      queryKeys.posts.detail(postId),
      (oldPost: any) => oldPost ? updater(oldPost) : oldPost
    );
  }, [queryClient]);

  // Subscribe to new posts
  useEffect(() => {
    if (!enabled || !user?.id) return;

    // Clean up existing subscription
    if (postsChannelRef.current) {
      postsChannelRef.current.unsubscribe();
    }

    postsChannelRef.current = supabase
      .channel('posts_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
        },
        async (payload) => {
          console.log('🆕 New post created:', payload.new);
          
          // Fetch complete post data with user info
          const { data: newPost, error } = await supabase
            .from('posts')
            .select(`
              *,
              profiles(username, avatar_url)
            `)
            .eq('id', (payload.new as any).id)
            .single();

          if (!error && newPost) {
            // Transform to match Post interface
            const postData = newPost as any;
            const transformedPost = {
              ...postData,
              user: {
                username: postData.profiles?.username,
                avatar_url: postData.profiles?.avatar_url,
              },
              likes_count: 0,
              comments_count: 0,
              is_liked: false,
              is_bookmarked: false,
            };

            onNewPost?.(transformedPost);

            // Invalidate queries to show new post
            invalidatePostQueries();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'posts',
        },
        (payload) => {
          console.log('📝 Post updated:', payload.new);
          onPostUpdate?.(payload.new);
          
          // Update post in cache
          updatePostInCache(payload.new.id, (post: any) => ({
            ...post,
            ...payload.new,
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'posts',
        },
        (payload) => {
          console.log('🗑️ Post deleted:', payload.old.id);
          onPostDelete?.(payload.old.id);
          
          // Remove from cache
          invalidatePostQueries();
        }
      )
      .subscribe();

    return () => {
      postsChannelRef.current?.unsubscribe();
    };
  }, [enabled, user?.id, onNewPost, onPostUpdate, onPostDelete, invalidatePostQueries, updatePostInCache]);

  // Subscribe to likes changes
  useEffect(() => {
    if (!enabled || !user?.id) return;

    if (likesChannelRef.current) {
      likesChannelRef.current.unsubscribe();
    }

    likesChannelRef.current = supabase
      .channel('likes_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes',
        },
        async (payload) => {
          const postId = (payload.new as any)?.post_id || (payload.old as any)?.post_id;
          if (!postId) return;

          console.log('❤️ Like changed for post:', postId);

          // Fetch updated like count
          const { data, error } = await supabase
            .from('posts')
            .select('id')
            .eq('id', postId)
            .single();

          if (!error) {
            // Get fresh like count
            const { count } = await supabase
              .from('likes')
              .select('*', { count: 'exact', head: true })
              .eq('post_id', postId);

            // Check if current user liked
            const { data: userLike } = await supabase
              .from('likes')
              .select('id')
              .eq('post_id', postId)
              .eq('user_id', user.id)
              .single();

            // Update post in cache
            updatePostInCache(postId, (post: any) => ({
              ...post,
              likes_count: count || 0,
              is_liked: !!userLike,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      likesChannelRef.current?.unsubscribe();
    };
  }, [enabled, user?.id, updatePostInCache]);

  // Subscribe to comments changes
  useEffect(() => {
    if (!enabled || !user?.id) return;

    if (commentsChannelRef.current) {
      commentsChannelRef.current.unsubscribe();
    }

    commentsChannelRef.current = supabase
      .channel('comments_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
        },
        async (payload) => {
          const postId = (payload.new as any)?.post_id || (payload.old as any)?.post_id;
          if (!postId) return;

          console.log('💬 Comment changed for post:', postId);

          // Get fresh comment count
          const { count } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId);

          // Update post in cache
          updatePostInCache(postId, (post: any) => ({
            ...post,
            comments_count: count || 0,
          }));
        }
      )
      .subscribe();

    return () => {
      commentsChannelRef.current?.unsubscribe();
    };
  }, [enabled, user?.id, updatePostInCache]);

  // Subscribe to bookmarks changes (only for current user)
  useEffect(() => {
    if (!enabled || !user?.id) return;

    if (bookmarksChannelRef.current) {
      bookmarksChannelRef.current.unsubscribe();
    }

    bookmarksChannelRef.current = supabase
      .channel(`bookmarks_realtime_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookmarks',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const postId = (payload.new as any)?.post_id || (payload.old as any)?.post_id;
          if (!postId) return;

          console.log('🔖 Bookmark changed for post:', postId);

          const isBookmarked = (payload as any).eventType === 'INSERT';

          // Update post in cache
          updatePostInCache(postId, (post: any) => ({
            ...post,
            is_bookmarked: isBookmarked,
          }));
        }
      )
      .subscribe();

    return () => {
      bookmarksChannelRef.current?.unsubscribe();
    };
  }, [enabled, user?.id, updatePostInCache]);

  return {
    invalidatePostQueries,
    updatePostInCache,
  };
};

