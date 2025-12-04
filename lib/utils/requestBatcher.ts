/**
 * Request Batching Utility
 * Reduces API calls by batching multiple requests together
 */

import { supabase } from '../supabase';
import { profileCache } from './profileCache';

interface BatchRequest {
  id: string;
  table: string;
  select: string;
  filters?: Record<string, any>;
  single?: boolean;
}

class RequestBatcher {
  private static instance: RequestBatcher;
  private pendingRequests: Map<string, BatchRequest> = new Map();
  private batchTimeout: any = null;
  private readonly BATCH_DELAY = 50; // 50ms delay to collect requests

  static getInstance(): RequestBatcher {
    if (!RequestBatcher.instance) {
      RequestBatcher.instance = new RequestBatcher();
    }
    return RequestBatcher.instance;
  }

  /**
   * Add a request to the batch
   */
  async batchRequest(request: BatchRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      // Store the request with resolve/reject callbacks
      const requestWithCallbacks = {
        ...request,
        resolve,
        reject,
      };

      this.pendingRequests.set(request.id, requestWithCallbacks as any);

      // Set up batch execution if not already scheduled
      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.executeBatch();
        }, this.BATCH_DELAY);
      }
    });
  }

  private async executeBatch(): Promise<void> {
    if (this.pendingRequests.size === 0) return;

// console.log(`🔄 Executing batch of ${this.pendingRequests.size} requests`);

    const requests = Array.from(this.pendingRequests.values());
    this.pendingRequests.clear();
    this.batchTimeout = null;

    // Group requests by table for optimization
    const requestsByTable = this.groupRequestsByTable(requests);

    // Execute requests for each table
    for (const [table, tableRequests] of requestsByTable) {
      await this.executeTableRequests(table, tableRequests);
    }
  }

  private groupRequestsByTable(requests: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();
    
    for (const request of requests) {
      if (!grouped.has(request.table)) {
        grouped.set(request.table, []);
      }
      grouped.get(request.table)!.push(request);
    }

    return grouped;
  }

  private async executeTableRequests(table: string, requests: any[]): Promise<void> {
    try {
      // For now, execute requests individually but could be optimized further
      // In the future, we could combine similar queries
      const results = await Promise.allSettled(
        requests.map(async (request) => {
          let query = supabase!.from(table).select(request.select);

          // Apply filters
          if (request.filters) {
            for (const [key, value] of Object.entries(request.filters)) {
              if (Array.isArray(value)) {
                query = query.in(key, value);
              } else {
                query = query.eq(key, value as any);
              }
            }
          }

          if (request.single) {
            return query.single();
          } else {
            return query;
          }
        })
      );

      // Resolve individual request promises
      results.forEach((result, index) => {
        const request = requests[index];
        if (result.status === 'fulfilled') {
          request.resolve(result.value);
        } else {
          request.reject(result.reason);
        }
      });

    } catch (__error) {
      // Reject all requests in case of batch failure
      requests.forEach(request => {
        request.reject(__error);
      });
    }
  }

  /**
   * Batch multiple profile requests with cache support
   */
  async batchProfileRequests(userIds: string[]): Promise<any[]> {
    if (userIds.length === 0) return [];

    try {
      // Check cache first
      const uncachedIds: string[] = [];
      const cachedProfiles: any[] = [];

      userIds.forEach(id => {
        const cached = profileCache.get(id);
        if (cached) {
          cachedProfiles.push(cached);
        } else {
          uncachedIds.push(id);
        }
      });

      // Fetch uncached profiles
      let fetchedProfiles: any[] = [];
      if (uncachedIds.length > 0) {
        const { data, error } = await supabase!
          .from('profiles')
          .select('id, username, avatar_url, bio, name')
          .in('id', uncachedIds)
          .abortSignal(AbortSignal.timeout(30000)); // 30s timeout

        if (error) throw error;
        
        fetchedProfiles = data || [];
        
        // Cache the fetched profiles
        profileCache.setMany(fetchedProfiles);
      }

      return [...cachedProfiles, ...fetchedProfiles];
    } catch (__error) {
      console.error('Error batching profile requests:', __error);
      return [];
    }
  }

  /**
   * Batch multiple post like status checks
   */
  async batchLikeStatusChecks(userId: string, postIds: string[]): Promise<Record<string, boolean>> {
    if (postIds.length === 0) return {};

    try {
      const { data, error } = await supabase!
        .from('post_likes')
        .select('post_id')
        .eq('user_id', userId)
        .in('post_id', postIds);

      if (error) throw error;

      const likedPosts: Record<string, boolean> = {};
      postIds.forEach(postId => {
        likedPosts[postId] = data?.some((like: any) => (like as any).post_id === postId) || false;
      });

      return likedPosts;
    } catch (__error) {
      console.error('Error batching like status checks:', __error);
      return {};
    }
  }
}

// Export singleton instance
export const requestBatcher = RequestBatcher.getInstance();

// Convenience functions
export const batchProfileRequests = (userIds: string[]) => 
  requestBatcher.batchProfileRequests(userIds);

export const batchLikeStatusChecks = (userId: string, postIds: string[]) => 
  requestBatcher.batchLikeStatusChecks(userId, postIds);

