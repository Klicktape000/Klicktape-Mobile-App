import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

interface OptimizedQueryOptions<T> extends Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'> {
  queryKey: string[];
  queryFn: () => Promise<T>;
  cacheDuration?: number;
  staleTime?: number;
  enableBackground?: boolean;
}

export function useOptimizedQuery<T>({
  queryKey,
  queryFn,
  cacheDuration = 5 * 60 * 1000, // 5 minutes default
  staleTime = 2 * 60 * 1000, // 2 minutes default
  enableBackground = true,
  ...options
}: OptimizedQueryOptions<T>): UseQueryResult<T> {
  
  // Memoize query options to prevent unnecessary re-renders
  const queryOptions = useMemo(() => ({
    queryKey,
    queryFn,
    staleTime,
    gcTime: cacheDuration, // Updated from cacheTime to gcTime
    refetchOnWindowFocus: enableBackground,
    refetchOnReconnect: enableBackground,
    retry: (failureCount: number, error: any) => {
      // Don't retry on 4xx errors
      if (error?.status >= 400 && error?.status < 500) {
        return false;
      }
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  }), [queryKey, queryFn, staleTime, cacheDuration, enableBackground, options]);

  return useQuery(queryOptions);
}

// Hook for paginated queries with optimizations
export function useOptimizedInfiniteQuery<T>({
  queryKey,
  queryFn,
  cacheDuration = 5 * 60 * 1000,
  staleTime = 2 * 60 * 1000,
  enableBackground = true,
  ...options
}: OptimizedQueryOptions<T> & {
  getNextPageParam?: (lastPage: T, pages: T[]) => any;
}) {
  const queryOptions = useMemo(() => ({
    queryKey,
    queryFn,
    staleTime,
    gcTime: cacheDuration,
    refetchOnWindowFocus: enableBackground,
    refetchOnReconnect: enableBackground,
    retry: 2,
    ...options,
  }), [queryKey, queryFn, staleTime, cacheDuration, enableBackground, options]);

  // Note: useInfiniteQuery would be imported from @tanstack/react-query
  // return useInfiniteQuery(queryOptions);
}

// Hook for mutations with optimistic updates
export function useOptimizedMutation<T, V>({
  mutationFn,
  onSuccess,
  onError,
  ...options
}: {
  mutationFn: (variables: V) => Promise<T>;
  onSuccess?: (data: T, variables: V) => void;
  onError?: (error: any, variables: V) => void;
}) {
  // Note: useMutation would be imported from @tanstack/react-query
  // return useMutation({
  //   mutationFn,
  //   onSuccess,
  //   onError,
  //   ...options,
  // });
}