// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logger } from './logger';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const jsonResponse = (data: any, status = 200, extraHeaders: Record<string,string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 
      ...corsHeaders, 
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
      ...extraHeaders,
    },
  });

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    logger.function.start();

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      logger.env.missing(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);
      return jsonResponse({ error: 'Missing Supabase environment configuration' }, 500);
    }

    const authHeader = req.headers.get('Authorization') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    });

    // Optional userId param to target a specific user (otherwise uses auth.uid())
    const url = new URL(req.url);
    const userIdParam = url.searchParams.get('userId');

    // Fetch all snapshot parts in parallel
    logger.function.step('Fetching leaderboard snapshot');
    const [leaderboardRes, statsRes, rewardsRes] = await Promise.all([
      (supabase as any).rpc('get_current_leaderboard'),
      (supabase as any).rpc('get_user_leaderboard_stats', userIdParam ? { p_user_id: userIdParam } : {} as any),
      supabase.from('user_rewards')
        .select('*')
        .order('earned_at', { ascending: false })
        .limit(25),
    ]);

    if (leaderboardRes.error) {
      logger.db.error('get_current_leaderboard failed', leaderboardRes.error);
      return jsonResponse({ error: leaderboardRes.error.message }, 500);
    }

    const stats = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;

    return jsonResponse({
      leaderboardTop50: leaderboardRes.data || [],
      userStats: stats || null,
      userRewards: rewardsRes.data || [],
    });
  } catch (error) {
    logger.function.error('Unexpected error in get-leaderboard-snapshot', error as any);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

