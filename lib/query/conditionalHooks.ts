/**
 * Conditional Query Hooks - Instagram-Style Optimized
 * Provides TanStack Query hooks that use TanStack when available, with Supabase fallback
 * Now properly uses TanStack Query for caching when LazyQueryProvider is ready
 */

import { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useLazyQuery } from './LazyQueryProvider';

// Generic hook that uses TanStack Query if available, otherwise direct Supabase
export const useConditionalQuery = <T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options: {
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
    refetchOnWindowFocus?: boolean;
  } = {}
) => {
  const { isReady, queryClient } = useLazyQuery();

  // Instagram-style: Use TanStack Query when available for shared caching
  if (isReady && queryClient) {
    // TanStack Query path - optimized with caching
    return useQuery({
      queryKey,
      queryFn,
      enabled: options.enabled !== false,
      staleTime: options.staleTime || 2 * 60 * 1000, // 2 minutes
      gcTime: options.cacheTime || 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: options.refetchOnWindowFocus ?? false,
    });
  }

  // Fallback: Manual state management when TanStack Query isn't loaded
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (options.enabled === false) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await queryFn();
        setData(result);
      } catch (__err) {
        setError(__err instanceof Error ? __err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [queryKey.join(','), options.enabled]);

  return {
    data,
    isLoading,
    error,
    refetch: async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await queryFn();
        setData(result);
        return result;
      } catch (__err) {
        setError(__err instanceof Error ? __err : new Error('Unknown error'));
        throw __err;
      } finally {
        setIsLoading(false);
      }
    },
  };
};

// Hook for fetching stories
export const useStories = (options: { enabled?: boolean } = {}) => {
  return useConditionalQuery(
    ['stories'],
    async () => {
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    options
  );
};

// Hook for fetching posts/tapes
export const usePosts = (options: { enabled?: boolean } = {}) => {
// console.log('🔍 usePosts: Hook called with options:', options);
  
  const queryFn = async () => {
// console.log('🔍 usePosts: Fetching posts from Supabase...');
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      // usePosts: Error fetching posts
      throw error;
    }

// console.log('✅ usePosts: Successfully fetched posts:', data?.length || 0, 'posts');
    return data;
  };
  
  return useConditionalQuery(['posts'], queryFn, options);
};

// Hook for fetching user profile
export const useUserProfile = (userId: string, options: { enabled?: boolean } = {}) => {
  return useConditionalQuery(
    ['profile', userId],
    async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    {
      ...options,
      enabled: options.enabled !== false && !!userId,
    }
  );
};

// Hook for fetching notifications
export const useNotifications = (userId: string, options: { enabled?: boolean } = {}) => {
  return useConditionalQuery(
    ['notifications', userId],
    async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    {
      ...options,
      enabled: options.enabled !== false && !!userId,
    }
  );
};

// Hook for fetching chat messages
export const useChatMessages = (chatId: string, options: { enabled?: boolean } = {}) => {
  return useConditionalQuery(
    ['chat', chatId, 'messages'],
    async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id (
            id,
            username,
            avatar_url
          )
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    {
      ...options,
      enabled: options.enabled !== false && !!chatId,
    }
  );
};

export default {
  useConditionalQuery,
  useStories,
  usePosts,
  useUserProfile,
  useNotifications,
  useChatMessages,
};

