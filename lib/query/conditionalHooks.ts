/**
 * Conditional Query Hooks
 * Provides TanStack Query hooks that fall back to direct Supabase calls
 */

import { useEffect, useState, useCallback } from 'react';
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
// console.log('🔍 useConditionalQuery: Called with queryKey:', queryKey, 'options:', options);
  
  const { isReady } = useLazyQuery();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

// console.log('🔍 useConditionalQuery: isReady:', isReady, 'enabled:', options.enabled);

  useEffect(() => {
// console.log('🔍 useConditionalQuery: useEffect triggered, enabled:', options.enabled);
    
    if (options.enabled === false) {
// console.log('🔍 useConditionalQuery: Query disabled, returning early');
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
// console.log('🔍 useConditionalQuery: Starting fetchData...');
        setIsLoading(true);
        setError(null);
        const result = await queryFn();
// console.log('🔍 useConditionalQuery: fetchData completed, result:', result);
        setData(result);
      } catch (__err) {
        // useConditionalQuery: fetchData error
        setError(__err instanceof Error ? __err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };

    // Always fetch data regardless of isReady state for now
// console.log('🔄 Fetching data for:', queryKey);
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

