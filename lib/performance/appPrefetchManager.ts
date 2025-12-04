/**
 * App-Wide Prefetch Manager
 * Preloads all critical app sections on launch for instant navigation
 * Zero loading states - Instagram-style instant transitions
 */

import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../query/queryKeys';
import { supabase } from '../supabase';
import { leaderboardAPI } from '@/lib/leaderboardApi';

interface PrefetchManagerConfig {
  queryClient: QueryClient;
  userId: string;
}

export class AppPrefetchManager {
  private queryClient: QueryClient;
  private userId: string;
  private isPrefetching = false;
  private prefetchComplete = false;

  constructor(config: PrefetchManagerConfig) {
    this.queryClient = config.queryClient;
    this.userId = config.userId;
  }

  /**
   * Prefetch ALL critical app sections on app launch
   * Runs IMMEDIATELY without any delays
   * Data is fetched from Supabase and cached for instant access
   */
  async prefetchAllSections() {
    if (this.isPrefetching || this.prefetchComplete) {
      return;
    }

    this.isPrefetching = true;
    const startTime = Date.now();
    console.log('🚀 Starting IMMEDIATE database prefetch - Loading ALL app sections from Supabase...');

    try {
      // Execute ALL prefetch operations IMMEDIATELY in parallel
      // This fetches data from Supabase database and stores in React Query cache
      await Promise.all([
        this.prefetchProfile(),
        this.prefetchLeaderboard(),
        this.prefetchReferrals(),
        this.prefetchMessages(),
        this.prefetchNotifications(),
        this.prefetchUserContent(),
        this.prefetchExploreFeed(),
        this.prefetchBookmarks(),
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;
      this.prefetchComplete = true;
      console.log(`✅ DATABASE PREFETCH COMPLETE in ${duration}ms - All sections cached and ready for instant navigation!`);
      console.log('📱 You can now navigate to any section (Messages, Notifications, Profile, Leaderboard, Referrals) with ZERO loading!');
    } catch (error) {
      console.error('❌ Error during database prefetch:', error);
    } finally {
      this.isPrefetching = false;
    }
  }

  /**
   * Prefetch user profile data
   */
  private async prefetchProfile() {
    try {
      const profileData: any = await this.queryClient.fetchQuery({
        queryKey: queryKeys.users.detail(this.userId),
        queryFn: async () => {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', this.userId)
            .single();
          return data;
        },
        staleTime: 60 * 60 * 1000, // 1 hour
      });

      // Prefetch followers/following counts
      await this.queryClient.fetchQuery({
        queryKey: ['profile', 'stats', this.userId],
        queryFn: async () => {
          const { data } = await supabase.rpc('get_user_stats', {
            user_id_param: this.userId,
          } as any);
          return data;
        },
        staleTime: 30 * 60 * 1000,
      });

      console.log('✅ Profile loaded from database and cached:', profileData?.username);
    } catch (error) {
      console.error('Profile prefetch error:', error);
    }
  }

  /**
   * Prefetch leaderboard data
   */
  private async prefetchLeaderboard() {
    try {
      await this.queryClient.prefetchQuery({
        queryKey: ['leaderboard', 'current'],
        queryFn: async () => {
          return await leaderboardAPI.getCurrentLeaderboard();
        },
        staleTime: 10 * 60 * 1000,
      });

      await this.queryClient.prefetchQuery({
        queryKey: ['leaderboard', 'stats', this.userId],
        queryFn: async () => {
          return await leaderboardAPI.getUserStats(this.userId);
        },
        staleTime: 10 * 60 * 1000,
      });

      await this.queryClient.prefetchQuery({
        queryKey: ['leaderboard', 'rewards', this.userId],
        queryFn: async () => {
          return await leaderboardAPI.getUserRewards(this.userId);
        },
        staleTime: 10 * 60 * 1000,
      });

      console.log('✅ Leaderboard prefetched');
    } catch (error) {
      console.error('Leaderboard prefetch error:', error);
    }
  }

  /**
   * Prefetch referrals data
   */
  private async prefetchReferrals() {
    try {
      await this.queryClient.prefetchQuery({
        queryKey: ['referral', 'dashboard', this.userId],
        queryFn: async () => {
          const { referralAPI } = await import('@/lib/referralApi');
          return await referralAPI.getReferralDashboard(this.userId);
        },
        staleTime: 10 * 60 * 1000,
      });

      await this.queryClient.prefetchQuery({
        queryKey: ['referral', 'link', this.userId],
        queryFn: async () => {
          const { referralAPI } = await import('@/lib/referralApi');
          return await referralAPI.generateReferralLink(this.userId);
        },
        staleTime: 30 * 60 * 1000,
      });

      console.log('✅ Referrals prefetched');
    } catch (error) {
      console.error('Referrals prefetch error:', error);
    }
  }

  /**
   * Prefetch messages/conversations
   */
  private async prefetchMessages() {
    try {
      // Prefetch conversations list
      const conversations: any = await this.queryClient.fetchQuery({
        queryKey: ['conversations', this.userId],
        queryFn: async () => {
          const { data } = await supabase.rpc('get_user_conversations', {
            user_id_param: this.userId,
          } as any);
          return data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
      });

      console.log(`✅ Messages: ${conversations?.length || 0} conversations loaded from database`);
      
      if (conversations && conversations.length > 0) {
        // Prefetch ALL conversations in parallel
        await Promise.all(
          conversations.map((conv: any) => 
            this.queryClient.prefetchQuery({
              queryKey: ['messages', conv.id],
              queryFn: async () => {
                const { data } = await supabase
                  .from('messages')
                  .select('*, sender:profiles!messages_sender_id_fkey(*)')
                  .or(`sender_id.eq.${this.userId},receiver_id.eq.${this.userId}`)
                  .order('created_at', { ascending: false })
                  .limit(50);
                return data;
              },
              staleTime: 2 * 60 * 1000, // 2 minutes
            })
          )
        );
        console.log(`   ↪ All ${conversations.length} conversations cached - ready for instant open`);
      }
    } catch (error) {
      console.error('Messages prefetch error:', error);
    }
  }

  /**
   * Prefetch notifications
   */
  private async prefetchNotifications() {
    try {
      const notifications: any = await this.queryClient.fetchQuery({
        queryKey: ['notifications', this.userId],
        queryFn: async () => {
          const { data } = await supabase
            .from('notifications')
            .select('*, sender:profiles!notifications_sender_id_fkey(*)')
            .eq('recipient_id', this.userId)
            .order('created_at', { ascending: false })
            .limit(100);
          return data;
        },
        staleTime: 1 * 60 * 1000, // 1 minute
      });

      console.log(`✅ Notifications: ${notifications?.length || 0} notifications loaded from database`);
      
      if (notifications && notifications.length > 0) {
        const contentPrefetches: Promise<any>[] = [];
        let postsCount = 0;
        let reelsCount = 0;
        let profilesCount = 0;

        notifications.forEach((notif: any) => {
          // Prefetch post if notification is about a post
          if (notif.post_id) {
            postsCount++;
            contentPrefetches.push(
              this.queryClient.prefetchQuery({
                queryKey: queryKeys.posts.detail(notif.post_id),
                queryFn: async () => {
                  const { data } = await supabase.rpc('get_complete_post_data', {
                    p_post_id: notif.post_id,
                    p_current_user_id: this.userId,
                  } as any);
                  return data;
                },
                staleTime: 5 * 60 * 1000,
              })
            );
          }

          // Prefetch reel if notification is about a reel
          if (notif.reel_id) {
            reelsCount++;
            contentPrefetches.push(
              this.queryClient.prefetchQuery({
                queryKey: ['reels', notif.reel_id],
                queryFn: async () => {
                  const { data } = await supabase
                    .from('reels')
                    .select('*, profiles:user_id (username, avatar_url)')
                    .eq('id', notif.reel_id)
                    .single();
                  return data;
                },
                staleTime: 5 * 60 * 1000,
              })
            );
          }

          // Prefetch user profile if notification is from a user
          if (notif.sender_id && notif.sender_id !== this.userId) {
            profilesCount++;
            contentPrefetches.push(
              this.queryClient.prefetchQuery({
                queryKey: queryKeys.users.detail(notif.sender_id),
                queryFn: async () => {
                  const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', notif.sender_id)
                    .single();
                  return data;
                },
                staleTime: 10 * 60 * 1000,
              })
            );
          }
        });

        await Promise.all(contentPrefetches);
        console.log(`   ↪ Linked content cached: ${postsCount} posts, ${reelsCount} reels, ${profilesCount} profiles`);
      }
    } catch (error) {
      console.error('Notifications prefetch error:', error);
    }
  }

  /**
   * Prefetch user's own content (posts, reels, stories)
   */
  private async prefetchUserContent() {
    try {
      // Prefetch user's posts
      await this.queryClient.prefetchQuery({
        queryKey: queryKeys.posts.user(this.userId),
        queryFn: async () => {
          const { data } = await supabase.rpc('get_user_posts', {
            p_user_id: this.userId,
            p_current_user_id: this.userId,
            p_limit: 50,
            p_offset: 0,
          } as any);
          return data;
        },
        staleTime: 10 * 60 * 1000,
      });

      // Prefetch user's reels
      await this.queryClient.prefetchQuery({
        queryKey: ['reels', 'user', this.userId],
        queryFn: async () => {
          const { data } = await supabase
            .from('reels')
            .select('*, profiles:user_id (username, avatar_url)')
            .eq('user_id', this.userId)
            .order('created_at', { ascending: false })
            .limit(50);
          return data;
        },
        staleTime: 10 * 60 * 1000,
      });

      console.log('✅ User content prefetched');
    } catch (error) {
      console.error('User content prefetch error:', error);
    }
  }

  /**
   * Prefetch explore feed
   */
  private async prefetchExploreFeed() {
    try {
      await this.queryClient.prefetchQuery({
        queryKey: queryKeys.posts.explore(),
        queryFn: async () => {
          const { data } = await supabase
            .from('posts')
            .select('*, profiles(username, avatar_url)')
            .order('likes_count', { ascending: false })
            .limit(30);
          return data;
        },
        staleTime: 10 * 60 * 1000,
      });

      console.log('✅ Explore feed prefetched');
    } catch (error) {
      console.error('Explore prefetch error:', error);
    }
  }

  /**
   * Prefetch bookmarks
   */
  private async prefetchBookmarks() {
    try {
      await this.queryClient.prefetchQuery({
        queryKey: queryKeys.posts.bookmarks(this.userId),
        queryFn: async () => {
          const { data } = await supabase.rpc('get_user_bookmarks_optimized', {
            p_user_id: this.userId,
            p_limit: 100,
            p_offset: 0,
          } as any);
          return data;
        },
        staleTime: 10 * 60 * 1000,
      });

      console.log('✅ Bookmarks prefetched');
    } catch (error) {
      console.error('Bookmarks prefetch error:', error);
    }
  }

  /**
   * Reset prefetch state (for logout/re-login)
   */
  reset() {
    this.isPrefetching = false;
    this.prefetchComplete = false;
  }
}

// Singleton instance
let prefetchManagerInstance: AppPrefetchManager | null = null;

export const getPrefetchManager = (queryClient: QueryClient, userId: string): AppPrefetchManager => {
  if (!prefetchManagerInstance || (prefetchManagerInstance as any).userId !== userId) {
    prefetchManagerInstance = new AppPrefetchManager({ queryClient, userId });
  }
  return prefetchManagerInstance;
};

export const resetPrefetchManager = () => {
  if (prefetchManagerInstance) {
    prefetchManagerInstance.reset();
  }
  prefetchManagerInstance = null;
};
