# 🏆 KlickTape Profile Tier API Guide

## 📋 Overview

The Profile Tier feature adds mythological rank tiers directly to user profiles, making it easy to display a user's current ranking status without complex joins. Users' profiles now include their current mythological tier (Loki, Odin, Poseidon, Zeus, or Hercules) which automatically syncs with the leaderboard rankings.

## 🗄️ Database Schema Changes

### Updated Profiles Table
```sql
-- New column added to profiles table
ALTER TABLE profiles ADD COLUMN current_tier rank_tier;
```

The `current_tier` column stores the user's current mythological tier:
- `'Loki of Klicktape'` (Ranks 1-10)
- `'Odin of Klicktape'` (Ranks 11-20)  
- `'Poseidon of Klicktape'` (Ranks 21-30)
- `'Zeus of Klicktape'` (Ranks 31-40)
- `'Hercules of Klicktape'` (Ranks 41-50)
- `NULL` (Not in current leaderboard)

## 🔧 Core Functions

### 1. get_user_current_tier(user_id UUID)
Returns the user's current mythological tier from the active leaderboard.

```sql
SELECT get_user_current_tier('550e8400-e29b-41d4-a716-446655440000');
-- Returns: 'Loki of Klicktape' or NULL
```

### 2. update_profile_tier(user_id UUID)
Updates a specific user's profile tier based on their current leaderboard position.

```sql
SELECT update_profile_tier('550e8400-e29b-41d4-a716-446655440000');
```

### 3. sync_all_profile_tiers()
Syncs all user profile tiers with the current active leaderboard.

```sql
SELECT sync_all_profile_tiers();
-- Returns: number of profiles updated
```

## ⚡ Automatic Synchronization

### Triggers
The system automatically updates profile tiers when:

1. **Leaderboard rankings change** (INSERT/UPDATE/DELETE on `leaderboard_rankings`)
2. **Leaderboard periods change** (when `is_active` status changes)

### Real-time Updates
- When a user's rank changes → Profile tier updates automatically
- When a new leaderboard period starts → All profile tiers sync automatically
- When a user is removed from leaderboard → Profile tier clears automatically

## 📱 Frontend API Usage

### 1. Get User Profile with Tier
```typescript
// Simple profile query with tier
const { data: profile, error } = await supabase
  .from('profiles')
  .select('id, username, avatar_url, current_tier')
  .eq('id', userId)
  .single();

// Response:
{
  id: "550e8400-e29b-41d4-a716-446655440000",
  username: "awesome_user",
  avatar_url: "https://...",
  current_tier: "Loki of Klicktape"
}
```

### 2. Get Enhanced Profile with Tier Info
```typescript
// Enhanced profile query with tier descriptions
const { data: profile, error } = await supabase
  .from('profiles_with_tier_info')
  .select('*')
  .eq('id', userId)
  .single();

// Response:
{
  id: "550e8400-e29b-41d4-a716-446655440000",
  username: "awesome_user",
  avatar_url: "https://...",
  current_tier: "Loki of Klicktape",
  tier_description: "The Trickster Gods",
  tier_rank_range: "Ranks 1-10",
  rank_position: 5,
  total_points: 2500.0
}
```

### 3. Get All Users with Tiers
```typescript
// Get users with their mythological tiers
const { data: users, error } = await supabase
  .from('profiles_with_tier_info')
  .select('username, current_tier, tier_description, rank_position')
  .not('current_tier', 'is', null)
  .order('rank_position');

// Response:
[
  {
    username: "top_creator",
    current_tier: "Loki of Klicktape",
    tier_description: "The Trickster Gods",
    rank_position: 1
  },
  // ...
]
```

### 4. Filter Users by Tier
```typescript
// Get all Loki tier users
const { data: lokiUsers, error } = await supabase
  .from('profiles')
  .select('username, avatar_url, current_tier')
  .eq('current_tier', 'Loki of Klicktape');

// Get users in top 3 tiers
const { data: topTierUsers, error } = await supabase
  .from('profiles')
  .select('username, avatar_url, current_tier')
  .in('current_tier', [
    'Loki of Klicktape',
    'Odin of Klicktape', 
    'Poseidon of Klicktape'
  ]);
```

## 🎨 UI Components

### Profile Tier Badge Component
```typescript
interface ProfileTierBadgeProps {
  tier: string | null;
  size?: 'small' | 'medium' | 'large';
  showDescription?: boolean;
}

const ProfileTierBadge: React.FC<ProfileTierBadgeProps> = ({ 
  tier, 
  size = 'medium',
  showDescription = false 
}) => {
  if (!tier) return null;

  const getTierConfig = (tier: string) => {
    switch (tier) {
      case 'Loki of Klicktape':
        return {
          gradient: 'from-purple-600 to-pink-600',
          icon: '🃏',
          description: 'The Trickster Gods',
          textColor: 'text-purple-100'
        };
      case 'Odin of Klicktape':
        return {
          gradient: 'from-blue-600 to-indigo-600',
          icon: '👁️',
          description: 'The All-Father Tier',
          textColor: 'text-blue-100'
        };
      case 'Poseidon of Klicktape':
        return {
          gradient: 'from-teal-600 to-cyan-600',
          icon: '🔱',
          description: 'The Sea Lords',
          textColor: 'text-teal-100'
        };
      case 'Zeus of Klicktape':
        return {
          gradient: 'from-yellow-500 to-orange-600',
          icon: '⚡',
          description: 'The Thunder Gods',
          textColor: 'text-yellow-100'
        };
      case 'Hercules of Klicktape':
        return {
          gradient: 'from-orange-600 to-red-600',
          icon: '💪',
          description: 'The Heroes',
          textColor: 'text-orange-100'
        };
      default:
        return null;
    }
  };

  const config = getTierConfig(tier);
  if (!config) return null;

  const sizeClasses = {
    small: 'px-2 py-1 text-xs',
    medium: 'px-3 py-2 text-sm',
    large: 'px-4 py-3 text-base'
  };

  return (
    <div className={`
      bg-gradient-to-r ${config.gradient} 
      ${sizeClasses[size]} 
      rounded-full inline-flex items-center space-x-1 
      ${config.textColor} font-semibold shadow-lg
    `}>
      <span>{config.icon}</span>
      <span>{tier}</span>
      {showDescription && (
        <span className="text-xs opacity-90">({config.description})</span>
      )}
    </div>
  );
};
```

### Profile Card with Tier
```typescript
const ProfileCard: React.FC<{ userId: string }> = ({ userId }) => {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles_with_tier_info')
        .select('*')
        .eq('id', userId)
        .single();
      
      setProfile(data);
    };

    fetchProfile();
  }, [userId]);

  if (!profile) return <div>Loading...</div>;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-4">
        <img 
          src={profile.avatar_url || '/default-avatar.png'}
          alt={profile.username}
          className="w-16 h-16 rounded-full"
        />
        
        <div className="flex-1">
          <h3 className="text-xl font-bold">{profile.username}</h3>
          <p className="text-gray-600">{profile.bio}</p>
          
          {profile.current_tier && (
            <div className="mt-2">
              <ProfileTierBadge 
                tier={profile.current_tier}
                showDescription={true}
              />
              
              {profile.rank_position && (
                <p className="text-sm text-gray-500 mt-1">
                  Rank #{profile.rank_position} • {profile.total_points} points
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

## 🔄 Real-time Subscriptions

### Subscribe to Profile Tier Changes
```typescript
const subscribeToProfileTierChanges = (userId: string) => {
  return supabase
    .channel(`profile-tier-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`
      },
      (payload) => {
        if (payload.new.current_tier !== payload.old.current_tier) {
          console.log('User tier changed:', {
            from: payload.old.current_tier,
            to: payload.new.current_tier
          });
          // Update UI with new tier
        }
      }
    )
    .subscribe();
};
```

## 📊 Analytics Queries

### Tier Distribution
```sql
-- Get tier distribution across all users
SELECT 
    current_tier,
    COUNT(*) as user_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM profiles 
WHERE current_tier IS NOT NULL
GROUP BY current_tier
ORDER BY 
    CASE current_tier
        WHEN 'Loki of Klicktape' THEN 1
        WHEN 'Odin of Klicktape' THEN 2
        WHEN 'Poseidon of Klicktape' THEN 3
        WHEN 'Zeus of Klicktape' THEN 4
        WHEN 'Hercules of Klicktape' THEN 5
    END;
```

### Users Without Tiers
```sql
-- Find users not in current leaderboard
SELECT 
    COUNT(*) as unranked_users,
    (SELECT COUNT(*) FROM profiles WHERE current_tier IS NOT NULL) as ranked_users
FROM profiles 
WHERE current_tier IS NULL;
```

## 🔒 Security & Permissions

### Row Level Security
The `current_tier` column inherits the existing RLS policies from the profiles table:
- Users can read all profiles (including tiers)
- Users can only update their own profile
- The tier column is automatically managed by triggers

### API Permissions
- `profiles_with_tier_info` view is accessible to all authenticated users
- Profile tier functions are executed automatically by triggers
- Manual tier sync functions require appropriate permissions

## 🚀 Benefits

### Performance
- **No joins required** for basic tier display
- **Instant tier access** from profile queries
- **Automatic synchronization** ensures data consistency

### User Experience
- **Profile tier badges** show status immediately
- **Real-time updates** when rankings change
- **Consistent tier display** across the application

### Developer Experience
- **Simple API** for tier access
- **Automatic maintenance** via triggers
- **Enhanced views** for complex queries

---

**The profile tier system is now fully integrated and ready for use! 🏆**
