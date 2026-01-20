/**
 * TanStack Query Hooks for Posts
 * Replaces direct Supabase calls with optimized query patterns
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { queryKeys } from '../queryKeys';
import { invalidateCache } from '../queryClient';
import { authManager } from '../../authManager';

// Types
interface Post {
  id: string;
  user_id: string;
  caption: string;
  image_urls: string[];
  created_at: string;
  likes_count: number;
  comments_count: number;
  user: {
    username: string;
    avatar_url: string;
  };
  is_liked?: boolean;
  is_bookmarked?: boolean;
  // Smart feed specific fields
  view_count?: number;
  last_viewed_at?: string;
  engagement_score?: number;
  smart_rank?: number;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user: {
    username: string;
    avatar_url: string;
  };
}

interface CreatePostData {
  caption: string;
  imageUrls: string[];
}

interface CreateCommentData {
  postId: string;
  content: string;
}

// Query Functions
const postsQueryFunctions = {
  /**
   * Get posts feed with pagination (OPTIMIZED - uses RPC function for better performance)
   */
  getPostsFeed: async ({ pageParam = 0 }: { pageParam?: number }) => {
    const POSTS_PER_PAGE = 10;
    const offset = pageParam * POSTS_PER_PAGE;

    // OPTIMIZED: Use RPC function to avoid N+1 queries
    // This pre-calculates likes_count, comments_count, is_liked, is_bookmarked in one query
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id || null;

      const { data: posts, error } = await supabase.rpc('get_posts_feed_optimized' as any, {
        p_user_id: currentUserId,
        p_limit: POSTS_PER_PAGE,
        p_offset: offset
      } as any);

      if (error) throw error;

      const postsArray = (posts || []) as any[];
      return {
        posts: postsArray,
        nextCursor: postsArray.length === POSTS_PER_PAGE ? pageParam + 1 : undefined,
      };
    } catch (error) {
      // Fallback to regular query if RPC not available
      const { data: posts, error: fallbackError } = await supabase
        .from('posts')
        .select(`
          *,
          profiles(username, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + POSTS_PER_PAGE - 1);

      if (fallbackError) throw fallbackError;

      // Transform and fetch like/bookmark status for the current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const postIds = (posts || []).map((p: any) => p.id);
      
      let likedPostIds = new Set<string>();
      let bookmarkedPostIds = new Set<string>();
      
      if (currentUser?.id && postIds.length > 0) {
        const [likesData, bookmarksData] = await Promise.all([
          supabase.from('likes').select('post_id').eq('user_id', currentUser.id).in('post_id', postIds),
          supabase.from('bookmarks').select('post_id').eq('user_id', currentUser.id).in('post_id', postIds)
        ]);
        likedPostIds = new Set(likesData.data?.map((l: any) => l.post_id) || []);
        bookmarkedPostIds = new Set(bookmarksData.data?.map((b: any) => b.post_id) || []);
      }
      
      const transformedPosts = (posts || []).map((post: any) => ({
        ...post,
        user: post.profiles || { username: 'Unknown', avatar_url: '' },
        likes_count: post.likes_count || 0,
        comments_count: post.comments_count || 0,
        is_liked: likedPostIds.has(post.id),
        is_bookmarked: bookmarkedPostIds.has(post.id)
      }));

      return {
        posts: transformedPosts,
        nextCursor: posts && posts.length === POSTS_PER_PAGE ? pageParam + 1 : undefined,
      };
    }
  },

  /**
   * Get single post with details (OPTIMIZED - uses RPC function)
   */
  getPost: async (postId: string, userId?: string): Promise<Post> => {
    const { data, error } = await supabase.rpc('get_complete_post_data' as any, {
      p_post_id: postId,
      p_current_user_id: userId || null,
    } as any);

    if (error || !data) {
      throw new Error(`Post not found: ${error?.message || 'No data'}`);
    }

    // Transform the RPC response to match Post interface
    const result = data as any;
    return {
      id: result.post.id,
      user_id: result.post.user_id,
      caption: result.post.caption,
      image_urls: result.post.image_urls,
      created_at: result.post.created_at,
      likes_count: result.post.likes_count,
      comments_count: result.post.comments_count,
      user: {
        username: result.author.username,
        avatar_url: result.author.avatar_url,
      },
      is_liked: result.is_liked,
      is_bookmarked: result.is_bookmarked,
    } as Post;
  },

  /**
   * Get post comments (OPTIMIZED - uses RPC function with pagination)
   */
  getPostComments: async (postId: string, limit: number = 20, offset: number = 0): Promise<Comment[]> => {
    const { data: comments, error } = await supabase.rpc('get_post_comments' as any, {
      p_post_id: postId,
      p_limit: limit,
      p_offset: offset,
    } as any);

    if (error) throw error;

    // Transform to match Comment interface
    const commentsArray = (comments || []) as any[];
    return commentsArray.map((c: any) => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      user: {
        username: c.username,
        avatar_url: c.avatar_url,
      },
    }));
  },

  /**
   * Get user posts (OPTIMIZED - uses RPC function)
   */
  getUserPosts: async (userId: string, currentUserId?: string, limit: number = 50, offset: number = 0): Promise<Post[]> => {
    const { data: posts, error } = await supabase.rpc('get_user_posts' as any, {
      p_user_id: userId,
      p_current_user_id: currentUserId || null,
      p_limit: limit,
      p_offset: offset,
    } as any);

    if (error) throw error;

    // Transform RPC response to Post interface
    const postsArray = (posts || []) as any[];
    return postsArray.map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      caption: p.caption,
      image_urls: p.image_urls,
      created_at: p.created_at,
      likes_count: p.likes_count,
      comments_count: p.comments_count,
      is_liked: p.is_liked,
      is_bookmarked: p.is_bookmarked,
      user: {
        username: p.username,
        avatar_url: p.avatar_url,
      },
    }));
  },

  /**
   * Get explore posts - OPTIMIZED: uses RPC function
   */
  getExplorePosts: async (): Promise<Post[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id || null;

      const { data: posts, error } = await supabase.rpc('get_explore_posts_optimized' as any, {
        p_user_id: currentUserId,
        p_limit: 30,
        p_offset: 0
      } as any);

      if (error) throw error;

      return (posts || []) as Post[];
    } catch (error) {
      console.warn('⚠️ get_explore_posts_optimized RPC failed, falling back:', error);
      
      const { data: posts, error: fallbackError } = await supabase
        .from('posts')
        .select(`
          *,
          profiles(username, avatar_url)
        `)
        .order('likes_count', { ascending: false })
        .limit(30);

      if (fallbackError) throw fallbackError;

      return (posts || []).map((p: any) => ({
        ...p,
        user: p.profiles || { username: 'Unknown', avatar_url: '' }
      })) as Post[];
    }
  },

  /**
   * Get bookmarked posts - OPTIMIZED with RPC function
   */
  getBookmarkedPosts: async (userId: string): Promise<Post[]> => {
    // Check if user is authenticated and can only access their own bookmarks
    const user = await authManager.getCurrentUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Only allow users to access their own bookmarks
    if (user.id !== userId) {
      throw new Error('Access denied: Users can only view their own saved posts');
    }

    // OPTIMIZED: Use RPC function to eliminate N+1 queries
    try {
      const { data: bookmarks, error } = await supabase.rpc('get_user_bookmarks_optimized' as any, {
        p_user_id: userId,
        p_limit: 100, // Get all bookmarks (or set a reasonable limit)
        p_offset: 0
      } as any);

      if (error) throw error;

      const bookmarksArray = (bookmarks || []) as any[];
      return bookmarksArray.map((bookmark: any) => ({
        id: bookmark.post_id,
        user_id: bookmark.post_user_id,
        caption: bookmark.post_caption,
        image_urls: bookmark.post_image_urls,
        created_at: bookmark.post_created_at,
        likes_count: bookmark.post_likes_count,
        comments_count: bookmark.post_comments_count,
        user: {
          username: bookmark.post_username,
          avatar_url: bookmark.post_avatar_url,
        },
        is_liked: false, // Can be populated separately if needed
        is_bookmarked: true, // Already bookmarked
      }));
    } catch (error) {
      console.warn('⚠️ RPC not available, falling back to regular query');
      
      // Fallback to regular query if RPC not deployed yet
      const { data: posts, error: fallbackError } = await supabase
        .from('bookmarks')
        .select(`
          post:posts(
            *,
            profiles(username, avatar_url)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fallbackError) throw fallbackError;

      return posts?.map((bookmark: any) => bookmark.post) || [];
    }
  },

  /**
   * Get smart feed posts using the database function
   */
  getSmartFeed: async ({ 
    pageParam = 0, 
    sessionId, 
    excludePostIds = [],
    limit = 10,
    excludeViewedTwice = true,
    respect24hCooldown = true
  }: { 
    pageParam?: number; 
    sessionId?: string;
    excludePostIds?: string[];
    limit?: number;
    excludeViewedTwice?: boolean;
    respect24hCooldown?: boolean;
  }) => {
    const offset = pageParam * limit;

    let user: any;
    try {
      user = await authManager.getCurrentUser();
      if (!user) {
// console.log('🔐 Smart Feed: No authenticated user, falling back to public feed');
        // Fallback to public posts feed when user is not authenticated
        return postsQueryFunctions.getPostsFeed({ pageParam });
      }
    } catch (__authError: any) {
// console.log('🔐 Smart Feed: Auth error, falling back to public feed:', __authError.message);
      // Fallback to public posts feed when authentication fails
      return postsQueryFunctions.getPostsFeed({ pageParam });
    }

    try {
      // Call the smart feed function we created in the database
      // Increased timeout for mobile networks
      const RPC_TIMEOUT_MS = 8000;

      let smartFeedData: any[] | null = null;
      let error: any = null;
      let timedOut = false;

      try {
        const rpcPromise = (supabase as any)
          .rpc('get_smart_feed_for_user', {
            p_user_id: user.id,
            p_session_id: sessionId,
            p_limit: limit,
            p_offset: offset,
            p_exclude_viewed_twice: excludeViewedTwice,
            p_respect_24h_cooldown: respect24hCooldown
          });

        const raceResult: any = await Promise.race([
          rpcPromise,
          new Promise((resolve) => setTimeout(() => resolve({ __timeout: true }), RPC_TIMEOUT_MS))
        ]);

        if (raceResult && raceResult.__timeout) {
          timedOut = true;
        } else {
          smartFeedData = raceResult?.data || [];
          error = raceResult?.error || null;
        }
      } catch (__rpcErr: any) {
        error = __rpcErr;
      }

      if (timedOut || error) {
        // Check if it's a missing function error
        if (!timedOut && (error?.message?.includes('get_smart_feed_for_user') || 
            error?.message?.includes('function') || 
            error?.message?.includes('schema cache'))) {
// console.warn('⚠️ Smart feed function not deployed yet, using regular feed fallback');
// console.warn('💡 To enable smart feed: Execute fix-smart-feed-function.sql in Supabase Dashboard');
        } else if (!timedOut) {
          console.error('❌ Smart feed error:', error);
        }
        // Fallback to regular feed if smart feed fails
        return postsQueryFunctions.getPostsFeed({ pageParam });
      }

      // Transform the smart feed data to match our Post interface
      const rawCount = Array.isArray(smartFeedData) ? smartFeedData.length : 0;
      let posts = smartFeedData?.map((post: any) => ({
        id: post.id,
        caption: post.caption,
        image_urls: post.image_urls,
        user_id: post.user_id,
        created_at: post.created_at,
        likes_count: post.likes_count,
        comments_count: post.comments_count,
        user: {
          id: post.user_id,
          username: post.username,
          avatar_url: post.avatar_url
        },
        // Smart feed specific fields
        view_count: post.view_count || 0,
        last_viewed_at: post.last_viewed_at,
        engagement_score: post.engagement_score,
        smart_rank: post.smart_rank,
        is_liked: post.is_liked !== undefined ? post.is_liked : false,
        is_bookmarked: post.is_bookmarked !== undefined ? post.is_bookmarked : false
      })) || [];

      // Client-side logic to populate is_liked and is_bookmarked fields if they are missing
      // (This ensures backward compatibility with older RPC versions while preparing for instant status)
      const needsStatusCheck = posts.length > 0 && user?.id && 
        (posts[0].is_liked === undefined || posts[0].is_liked === false); 

      if (needsStatusCheck) {
        try {
          // Get post IDs for batch query
          const postIds = posts.map((p: any) => p.id);
          
          // Batch query for likes and bookmarks in parallel
          const [likesData, bookmarksData] = await Promise.all([
            supabase
              .from('likes')
              .select('post_id')
              .eq('user_id', user.id)
              .in('post_id', postIds),
            supabase
              .from('bookmarks')
              .select('post_id')
              .eq('user_id', user.id)
              .in('post_id', postIds)
          ]);

          // Create sets for O(1) lookup
          const likedPostIds = new Set(likesData.data?.map((like: any) => like.post_id) || []);
          const bookmarkedPostIds = new Set(bookmarksData.data?.map((bookmark: any) => bookmark.post_id) || []);

          // Update posts with actual like and bookmark status
          posts.forEach((post: any) => {
            // Only update if it was false/missing, to avoid overwriting if the RPC already returned true
            if (!post.is_liked) post.is_liked = likedPostIds.has(post.id);
            if (!post.is_bookmarked) post.is_bookmarked = bookmarkedPostIds.has(post.id);
          });
        } catch (__error) {
          console.error('Error fetching like/bookmark status for smart feed:', __error);
        }
      }

      // Client-side filtering: exclude posts that user has already seen in this session
      if (excludePostIds && excludePostIds.length > 0) {
        const excludeSet = new Set(excludePostIds);
        posts = posts.filter((p: any) => !excludeSet.has(p.id));
      }

      // Prefer newer and unseen posts: sort so that unseen (no last_viewed_at) come first, then by created_at desc
      posts = posts.sort((a: any, b: any) => {
        const aUnseen = !a.last_viewed_at;
        const bUnseen = !b.last_viewed_at;
        if (aUnseen !== bUnseen) return aUnseen ? -1 : 1;
        const aDate = new Date(a.created_at).getTime();
        const bDate = new Date(b.created_at).getTime();
        return bDate - aDate;
      });

// console.log(`✅ Smart feed loaded: ${posts.length} posts`);
      return {
        posts,
        // Use raw server count for pagination to ensure infinite feed continues
        nextCursor: rawCount === limit ? pageParam + 1 : undefined,
      };

    } catch (__error: any) {
// console.warn('⚠️ Smart feed unavailable, falling back to regular feed:', __error.message);
      // Fallback to regular feed if smart feed fails
      return postsQueryFunctions.getPostsFeed({ pageParam });
    }
  },
};

// Mutation Functions
const postsMutationFunctions = {
  /**
   * Create a new post
   */
  createPost: async (data: CreatePostData) => {
     const user = await authManager.getCurrentUser();
     if (!user) throw new Error('User not authenticated');

    const { data: post, error } = await (supabase
      .from('posts') as any)
      .insert({
        user_id: user.id,
        caption: data.caption,
        image_urls: data.imageUrls,
      })
      .select()
      .single();

    if (error) throw error;

    return post;
  },

  /**
   * Like/unlike a post - OPTIMIZED: uses atomic lightning RPC
   */
  togglePostLike: async (postId: string) => {
     const user = await authManager.getCurrentUser();
     if (!user) throw new Error('User not authenticated');

    // Use fast lightning RPC function instead of multiple API calls
    const { data: isLiked, error } = await supabase.rpc('lightning_toggle_like_v4', {
      post_id_param: postId,
      user_id_param: user.id,
    } as any);

    if (error) throw error;

    return { liked: isLiked };
  },

  /**
   * Bookmark/unbookmark a post - OPTIMIZED: uses atomic lightning RPC
   */
  togglePostBookmark: async (postId: string) => {
     const user = await authManager.getCurrentUser();
     if (!user) throw new Error('User not authenticated');

    // Use fast lightning RPC function instead of multiple API calls
    const { data: isBookmarked, error } = await supabase.rpc('lightning_toggle_bookmark_v3', {
      post_id_param: postId,
      user_id_param: user.id,
    } as any);

    if (error) throw error;

    return { bookmarked: isBookmarked };
  },

  /**
   * Add comment to post
   */
  createComment: async (data: CreateCommentData) => {
     const user = await authManager.getCurrentUser();
     if (!user) throw new Error('User not authenticated');

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        post_id: data.postId,
        user_id: user.id,
        content: data.content,
      } as any)
      .select(`
        id,
        content,
        created_at,
        user:profiles!fk_comments_user (
          username,
          avatar_url
        )
      `)
      .single();

    if (error) throw error;

    return comment;
  },

  /**
   * Delete a post
   */
  deletePost: async (postId: string) => {
     const user = await authManager.getCurrentUser();
     if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', user.id);

    if (error) throw error;

    return true;
  },
};

// Custom Hooks
export const usePostsFeed = (
  options?: any
) => {
  return useInfiniteQuery({
    queryKey: queryKeys.posts.lists(),
    queryFn: ({ pageParam }: { pageParam: number }) => postsQueryFunctions.getPostsFeed({ pageParam }),
    getNextPageParam: (lastPage: any) => lastPage.nextCursor,
    initialPageParam: 0,
    ...options,
  } as any);
};

export const useSmartFeed = (
  sessionId?: string,
  excludePostIds?: string[],
  smartFeedOptions?: {
    limit?: number;
    excludeViewedTwice?: boolean;
    respect24hCooldown?: boolean;
  },
  options?: any
) => {
  return useInfiniteQuery({
    queryKey: ['smartFeed', sessionId, excludePostIds, smartFeedOptions],
    queryFn: ({ pageParam }: { pageParam: number }) => 
      postsQueryFunctions.getSmartFeed({ 
        pageParam, 
        sessionId, 
        excludePostIds,
        limit: smartFeedOptions?.limit,
        excludeViewedTwice: smartFeedOptions?.excludeViewedTwice,
        respect24hCooldown: smartFeedOptions?.respect24hCooldown
      }),
    getNextPageParam: (lastPage: any) => lastPage.nextCursor,
    initialPageParam: 0,
    enabled: true, // Always enable - getSmartFeed has internal fallback to regular feed
    ...options,
  } as any);
};

export const usePost = (
  postId: string,
  userId?: string,
  options?: Omit<UseQueryOptions<Post, Error>, 'queryKey' | 'queryFn'> & {
    staleTime?: number;
    cacheTime?: number;
    refetchOnMount?: boolean;
    refetchOnWindowFocus?: boolean;
    retry?: number;
    networkMode?: 'always' | 'online' | 'offlineFirst';
  }
) => {
  return useQuery({
    queryKey: queryKeys.posts.detail(postId),
    queryFn: () => postsQueryFunctions.getPost(postId, userId),
    enabled: !!postId,
    // INSTAGRAM-STYLE: Instant display defaults
    staleTime: options?.staleTime !== undefined ? options.staleTime : Infinity,
    gcTime: options?.cacheTime !== undefined ? options.cacheTime : 24 * 60 * 60 * 1000,
    refetchOnMount: options?.refetchOnMount !== undefined ? options.refetchOnMount : false,
    refetchOnWindowFocus: options?.refetchOnWindowFocus !== undefined ? options.refetchOnWindowFocus : false,
    retry: options?.retry !== undefined ? options.retry : 0,
    networkMode: options?.networkMode || 'always',
    ...options,
  });
};

export const usePostComments = (
  postId: string,
  limit: number = 20,
  offset: number = 0,
  options?: Omit<UseQueryOptions<Comment[], Error>, 'queryKey' | 'queryFn'> & {
    staleTime?: number;
    cacheTime?: number;
    refetchOnMount?: boolean;
    retry?: number;
  }
) => {
  return useQuery({
    queryKey: [...queryKeys.comments.post(postId), limit, offset],
    queryFn: () => postsQueryFunctions.getPostComments(postId, limit, offset),
    enabled: options?.enabled !== undefined ? options.enabled : !!postId,
    // INSTAGRAM-STYLE: Instant display defaults
    staleTime: options?.staleTime !== undefined ? options.staleTime : Infinity,
    gcTime: options?.cacheTime !== undefined ? options.cacheTime : 24 * 60 * 60 * 1000,
    refetchOnMount: options?.refetchOnMount !== undefined ? options.refetchOnMount : false,
    retry: options?.retry !== undefined ? options.retry : 0,
    ...options,
  });
};

export const useUserPosts = (
  userId: string,
  currentUserId?: string,
  limit: number = 50,
  offset: number = 0,
  options?: Omit<UseQueryOptions<Post[], Error>, 'queryKey' | 'queryFn'> & {
    staleTime?: number;
    cacheTime?: number;
  }
) => {
  return useQuery({
    queryKey: [...queryKeys.posts.user(userId), limit, offset],
    queryFn: () => postsQueryFunctions.getUserPosts(userId, currentUserId, limit, offset),
    enabled: !!userId,
    staleTime: options?.staleTime || 1000 * 60 * 3, // 3 minutes default
    gcTime: options?.cacheTime || 1000 * 60 * 10, // 10 minutes default
    ...options,
  });
};

export const useExplorePosts = (
  options?: Omit<UseQueryOptions<Post[], Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.posts.explore(),
    queryFn: postsQueryFunctions.getExplorePosts,
    ...options,
  });
};

export const useBookmarkedPosts = (
  userId: string,
  options?: Omit<UseQueryOptions<Post[], Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: queryKeys.posts.bookmarks(userId),
    queryFn: () => postsQueryFunctions.getBookmarkedPosts(userId),
    enabled: !!userId,
    ...options,
  });
};

export const useCreatePost = (
  options?: UseMutationOptions<any, Error, CreatePostData>
) => {
  return useMutation({
    mutationFn: postsMutationFunctions.createPost,
    onSuccess: async () => {
      // Invalidate posts feed and user posts
      await invalidateCache(queryKeys.posts.lists());
      
      const user = await authManager.getCurrentUser();
       if (user) {
        await invalidateCache(queryKeys.posts.user(user.id));
      }

// console.log('✅ Post created successfully, cache invalidated');
    },
    ...options,
  });
};

export const useTogglePostLike = (
  options?: UseMutationOptions<any, Error, string>
) => {
  return useMutation({
    mutationFn: postsMutationFunctions.togglePostLike,
    onSuccess: async (data, postId) => {
      // Invalidate post details and feed
      await invalidateCache(queryKeys.posts.detail(postId));
      await invalidateCache(queryKeys.posts.lists());

// console.log('✅ Post like toggled successfully');
    },
    ...options,
  });
};

export const useTogglePostBookmark = (
  options?: UseMutationOptions<any, Error, string>
) => {
  return useMutation({
    mutationFn: postsMutationFunctions.togglePostBookmark,
    onSuccess: async (data, postId) => {
      // Invalidate post details and bookmarks
      await invalidateCache(queryKeys.posts.detail(postId));
      
      const user = await authManager.getCurrentUser();
       if (user) {
        await invalidateCache(queryKeys.posts.bookmarks(user.id));
      }

// console.log('✅ Post bookmark toggled successfully');
    },
    ...options,
  });
};

export const useCreateComment = (
  options?: UseMutationOptions<any, Error, CreateCommentData>
) => {
  return useMutation({
    mutationFn: postsMutationFunctions.createComment,
    onSuccess: async (data, variables) => {
      // Invalidate post comments and post details
      await invalidateCache(queryKeys.comments.post(variables.postId));
      await invalidateCache(queryKeys.posts.detail(variables.postId));

// console.log('✅ Comment created successfully');
    },
    ...options,
  });
};

export const useDeletePost = (
  options?: UseMutationOptions<boolean, Error, string>
) => {
  return useMutation({
    mutationFn: postsMutationFunctions.deletePost,
    onSuccess: async (data, postId) => {
      // Invalidate posts feed and user posts
      await invalidateCache(queryKeys.posts.lists());
      
      const user = await authManager.getCurrentUser();
       if (user) {
        await invalidateCache(queryKeys.posts.user(user.id));
      }

// console.log('✅ Post deleted successfully, cache invalidated');
    },
    ...options,
  });
};

/**
 * Hook to prefetch post data (for hover/scroll optimization)
 */
export const usePrefetchPost = () => {
  const queryClient = useQueryClient();

  return async (postId: string, userId?: string) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.posts.detail(postId),
      queryFn: () => postsQueryFunctions.getPost(postId, userId),
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  };
};

/**
 * Hook to prefetch multiple posts data
 */
export const usePrefetchPosts = () => {
  const queryClient = useQueryClient();

  return async (postIds: string[], userId?: string) => {
    // Prefetch in parallel
    await Promise.all(
      postIds.map(postId =>
        queryClient.prefetchQuery({
          queryKey: queryKeys.posts.detail(postId),
          queryFn: () => postsQueryFunctions.getPost(postId, userId),
          staleTime: 1000 * 60 * 5, // 5 minutes
        })
      )
    );
  };
};

export default {
  usePostsFeed,
  useSmartFeed,
  usePost,
  usePostComments,
  useUserPosts,
  useExplorePosts,
  useBookmarkedPosts,
  useCreatePost,
  useTogglePostLike,
  useTogglePostBookmark,
  useCreateComment,
  useDeletePost,
  usePrefetchPost,
  usePrefetchPosts,
};

