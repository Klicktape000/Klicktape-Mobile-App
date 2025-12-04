# 🏆 KlickTape Mythological Ranking System - API Documentation

## 📊 Database Schema

### Mythological Rank Tiers
```sql
CREATE TYPE rank_tier AS ENUM (
    'Loki of Klicktape',      -- Ranks 1-10
    'Odin of Klicktape',      -- Ranks 11-20
    'Poseidon of Klicktape',  -- Ranks 21-30
    'Zeus of Klicktape',      -- Ranks 31-40
    'Hercules of Klicktape'   -- Ranks 41-50
);
```

### Updated Tables

#### leaderboard_rankings
```sql
CREATE TABLE leaderboard_rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_id UUID NOT NULL REFERENCES leaderboard_periods(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rank_position INTEGER NOT NULL CHECK (rank_position >= 1 AND rank_position <= 50),
    rank_tier rank_tier NOT NULL,  -- 🆕 Mythological tier
    total_points DECIMAL(8,1) NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);
```

#### user_rewards
```sql
CREATE TABLE user_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES leaderboard_periods(id) ON DELETE CASCADE,
    reward_type reward_type NOT NULL,
    rank_achieved INTEGER NOT NULL,
    rank_tier rank_tier NOT NULL,  -- 🆕 Mythological tier
    title_text TEXT,
    badge_icon TEXT,
    earned_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🔧 Core Functions

### get_rank_tier(rank_position INTEGER)
Automatically determines mythological tier based on rank position.

```sql
SELECT get_rank_tier(5);   -- Returns: 'Loki of Klicktape'
SELECT get_rank_tier(15);  -- Returns: 'Odin of Klicktape'
SELECT get_rank_tier(25);  -- Returns: 'Poseidon of Klicktape'
SELECT get_rank_tier(35);  -- Returns: 'Zeus of Klicktape'
SELECT get_rank_tier(45);  -- Returns: 'Hercules of Klicktape'
```

## 📱 Frontend API Queries

### 1. Get Current Leaderboard with Mythological Tiers
```typescript
const { data: leaderboard, error } = await supabase
  .from('leaderboard_with_tiers')
  .select('*')
  .order('rank_position');

// Response:
[
  {
    rank_position: 1,
    rank_tier: "Loki of Klicktape",
    tier_description: "The Trickster Gods (Ranks 1-10)",
    username: "top_creator",
    avatar_url: "https://...",
    total_points: 2500.0
  },
  // ...
]
```

### 2. Get User's Current Rank and Tier
```typescript
const { data: userRank, error } = await supabase
  .from('leaderboard_rankings')
  .select(`
    rank_position,
    rank_tier,
    total_points,
    period_id,
    leaderboard_periods(start_date, end_date, is_active)
  `)
  .eq('user_id', userId)
  .eq('leaderboard_periods.is_active', true)
  .single();

// Response:
{
  rank_position: 7,
  rank_tier: "Loki of Klicktape",
  total_points: 1800.0,
  period_id: "uuid...",
  leaderboard_periods: {
    start_date: "2025-10-01T00:00:00Z",
    end_date: "2025-10-08T00:00:00Z",
    is_active: true
  }
}
```

### 3. Get Tier Distribution
```typescript
const { data: tierStats, error } = await supabase
  .rpc('get_tier_distribution');

// Custom function to get tier distribution:
CREATE OR REPLACE FUNCTION get_tier_distribution()
RETURNS TABLE(
  tier rank_tier,
  user_count bigint,
  percentage numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lr.rank_tier as tier,
    COUNT(*) as user_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
  FROM leaderboard_rankings lr
  WHERE lr.period_id = (
    SELECT id FROM leaderboard_periods WHERE is_active = true LIMIT 1
  )
  GROUP BY lr.rank_tier
  ORDER BY MIN(lr.rank_position);
END;
$$ LANGUAGE plpgsql;
```

### 4. Get User's Tier History
```typescript
const { data: tierHistory, error } = await supabase
  .from('user_rewards')
  .select(`
    period_id,
    rank_achieved,
    rank_tier,
    earned_at,
    leaderboard_periods(start_date, end_date)
  `)
  .eq('user_id', userId)
  .order('earned_at', { ascending: false });

// Response:
[
  {
    period_id: "uuid...",
    rank_achieved: 5,
    rank_tier: "Loki of Klicktape",
    earned_at: "2025-10-01T12:00:00Z",
    leaderboard_periods: {
      start_date: "2025-09-24T00:00:00Z",
      end_date: "2025-10-01T00:00:00Z"
    }
  },
  // ...
]
```

### 5. Get Tier Progression Info
```typescript
const { data: progression, error } = await supabase
  .rpc('get_user_tier_progression', { user_id: userId });

// Custom function for tier progression:
CREATE OR REPLACE FUNCTION get_user_tier_progression(user_id UUID)
RETURNS TABLE(
  current_rank integer,
  current_tier rank_tier,
  current_points numeric,
  next_tier rank_tier,
  next_tier_threshold integer,
  points_to_next_tier integer
) AS $$
DECLARE
  current_rank_pos integer;
  current_tier_val rank_tier;
  current_points_val numeric;
BEGIN
  -- Get current user rank
  SELECT rank_position, rank_tier, total_points
  INTO current_rank_pos, current_tier_val, current_points_val
  FROM leaderboard_rankings
  WHERE leaderboard_rankings.user_id = get_user_tier_progression.user_id
  AND period_id = (SELECT id FROM leaderboard_periods WHERE is_active = true LIMIT 1);
  
  RETURN QUERY
  SELECT 
    current_rank_pos,
    current_tier_val,
    current_points_val,
    CASE 
      WHEN current_rank_pos > 40 THEN 'Zeus of Klicktape'::rank_tier
      WHEN current_rank_pos > 30 THEN 'Poseidon of Klicktape'::rank_tier
      WHEN current_rank_pos > 20 THEN 'Odin of Klicktape'::rank_tier
      WHEN current_rank_pos > 10 THEN 'Loki of Klicktape'::rank_tier
      ELSE current_tier_val
    END as next_tier,
    CASE 
      WHEN current_rank_pos > 40 THEN 31
      WHEN current_rank_pos > 30 THEN 21
      WHEN current_rank_pos > 20 THEN 11
      WHEN current_rank_pos > 10 THEN 1
      ELSE current_rank_pos
    END as next_tier_threshold,
    GREATEST(0, current_rank_pos - CASE 
      WHEN current_rank_pos > 40 THEN 31
      WHEN current_rank_pos > 30 THEN 21
      WHEN current_rank_pos > 20 THEN 11
      WHEN current_rank_pos > 10 THEN 1
      ELSE current_rank_pos
    END) as points_to_next_tier;
END;
$$ LANGUAGE plpgsql;
```

## 🎨 UI Component Examples

### Tier Badge Component
```typescript
interface TierBadgeProps {
  tier: string;
  rank: number;
  size?: 'small' | 'medium' | 'large';
}

const TierBadge: React.FC<TierBadgeProps> = ({ tier, rank, size = 'medium' }) => {
  const getTierConfig = (tier: string) => {
    switch (tier) {
      case 'Loki of Klicktape':
        return {
          gradient: 'from-purple-600 to-pink-600',
          icon: '🃏',
          description: 'The Trickster Gods'
        };
      case 'Odin of Klicktape':
        return {
          gradient: 'from-blue-600 to-indigo-600',
          icon: '👁️',
          description: 'The All-Father Tier'
        };
      case 'Poseidon of Klicktape':
        return {
          gradient: 'from-teal-600 to-cyan-600',
          icon: '🔱',
          description: 'The Sea Lords'
        };
      case 'Zeus of Klicktape':
        return {
          gradient: 'from-yellow-500 to-orange-600',
          icon: '⚡',
          description: 'The Thunder Gods'
        };
      case 'Hercules of Klicktape':
        return {
          gradient: 'from-orange-600 to-red-600',
          icon: '💪',
          description: 'The Heroes'
        };
      default:
        return {
          gradient: 'from-gray-500 to-gray-600',
          icon: '🏆',
          description: 'Unranked'
        };
    }
  };

  const config = getTierConfig(tier);
  
  return (
    <div className={`bg-gradient-to-r ${config.gradient} rounded-lg p-4 text-white`}>
      <div className="flex items-center space-x-2">
        <span className="text-2xl">{config.icon}</span>
        <div>
          <h3 className="font-bold">{tier}</h3>
          <p className="text-sm opacity-90">{config.description}</p>
          <p className="text-xs">Rank #{rank}</p>
        </div>
      </div>
    </div>
  );
};
```

### Leaderboard Component
```typescript
const MythologicalLeaderboard: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  
  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data } = await supabase
        .from('leaderboard_with_tiers')
        .select('*')
        .order('rank_position')
        .limit(50);
      
      setLeaderboard(data || []);
    };
    
    fetchLeaderboard();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">🏆 Mythological Leaderboard</h2>
      
      {leaderboard.map((user, index) => (
        <div key={user.id} className="flex items-center space-x-4 p-4 bg-white rounded-lg shadow">
          <div className="text-2xl font-bold text-gray-500">
            #{user.rank_position}
          </div>
          
          <img 
            src={user.avatar_url || '/default-avatar.png'} 
            alt={user.username}
            className="w-12 h-12 rounded-full"
          />
          
          <div className="flex-1">
            <h3 className="font-semibold">{user.username}</h3>
            <p className="text-sm text-gray-600">{user.tier_description}</p>
          </div>
          
          <TierBadge 
            tier={user.rank_tier} 
            rank={user.rank_position}
            size="small"
          />
          
          <div className="text-right">
            <div className="font-bold">{user.total_points}</div>
            <div className="text-sm text-gray-500">points</div>
          </div>
        </div>
      ))}
    </div>
  );
};
```

## 🔄 Real-time Updates

### Subscribe to Leaderboard Changes
```typescript
const subscribeToLeaderboard = () => {
  return supabase
    .channel('leaderboard-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'leaderboard_rankings'
      },
      (payload) => {
        console.log('Leaderboard updated:', payload);
        // Refresh leaderboard data
      }
    )
    .subscribe();
};
```

## 📊 Analytics Queries

### Tier Movement Analysis
```sql
-- Track users moving between tiers
WITH tier_changes AS (
  SELECT 
    user_id,
    rank_tier,
    LAG(rank_tier) OVER (PARTITION BY user_id ORDER BY earned_at) as previous_tier,
    earned_at
  FROM user_rewards
  ORDER BY user_id, earned_at
)
SELECT 
  previous_tier,
  rank_tier as current_tier,
  COUNT(*) as movement_count
FROM tier_changes
WHERE previous_tier IS NOT NULL
AND previous_tier != rank_tier
GROUP BY previous_tier, rank_tier
ORDER BY movement_count DESC;
```

---

**The mythological ranking system is now fully documented and ready for implementation! 🏆⚡**
