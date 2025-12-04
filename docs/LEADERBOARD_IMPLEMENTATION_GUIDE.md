# Leaderboard System Implementation Guide

## Overview

This guide documents the complete implementation of the social media engagement leaderboard system for Klicktape. The system tracks user engagement across posts, reels, and stories, ranking the top 50 users based on points earned through likes, comments, and shares.

## Features Implemented

### 🏆 Core Leaderboard Features
- **Dynamic Rankings**: Real-time top 50 user rankings
- **Weekly Periods**: Automatic weekly leaderboard cycles (Monday to Sunday)
- **Point System**: Comprehensive point allocation for different engagement types
- **Rewards System**: Tiered rewards for top performers
- **User Stats**: Individual user performance tracking

### 📊 Point Allocation System
| Engagement Type | Points | Description |
|----------------|--------|-------------|
| Story Like | 1.0 | Like on a story |
| Story Comment | 2.0 | Comment on a story |
| Photo Like | 2.0 | Like on a post |
| Photo Comment | 1.5 | Comment on a post |
| Reel Like | 2.0 | Like on a reel |
| Reel Comment | 3.0 | Comment on a reel |
| Share (Any) | 3.0 | Share story, post, or reel |

### 🎁 Rewards Structure
- **Ranks 1-10**: Premium badges (⭐)
- **Ranks 11-20**: Normal badges (🌟)
- **Ranks 21-30**: Premium titles (👑) - "Engagement Master"
- **Ranks 31-50**: Normal titles (🏆) - "Active Member"

## Database Schema

### Core Tables Created
1. **`leaderboard_periods`** - Weekly leaderboard periods
2. **`engagement_points`** - Individual point records
3. **`leaderboard_rankings`** - Current top 50 rankings
4. **`shares`** - Content sharing tracking
5. **`story_likes`** - Story like tracking
6. **`story_comments`** - Story comment tracking
7. **`user_rewards`** - Earned rewards tracking

### Key Functions
- `get_current_leaderboard_period()` - Get/create active period
- `add_engagement_points()` - Add points for engagement
- `remove_engagement_points()` - Remove points (for unlikes)
- `update_leaderboard_rankings()` - Refresh top 50 rankings
- `get_current_leaderboard()` - Get current rankings
- `get_user_leaderboard_stats()` - Get user's stats
- `complete_leaderboard_period()` - End period and distribute rewards

### Automatic Triggers
The system includes database triggers that automatically track points for:
- Post likes/unlikes
- Reel likes/unlikes
- Story likes/unlikes
- Post comments (add/delete)
- Reel comments (add/delete)
- Story comments (add/delete)
- Content shares

## Frontend Components

### 🎯 Leaderboard Component (`components/Leaderboard.tsx`)
- **Rankings Tab**: Top 50 leaderboard with user positions
- **Stats Tab**: Personal performance metrics and points guide
- **Rewards Tab**: User's earned rewards and achievements
- **Real-time Updates**: Refresh functionality for live data
- **Responsive Design**: Optimized for mobile and tablet

### 🔧 Integration Points
- **Sidebar**: Leaderboard accessible via sidebar menu
- **Posts**: Share tracking integrated into post sharing
- **Reels**: Share tracking integrated into reel sharing
- **Stories**: Ready for story interaction implementation

## API Integration

### 📡 Leaderboard API (`lib/leaderboardApi.ts`)
```typescript
// Get current leaderboard
const leaderboard = await leaderboardAPI.getCurrentLeaderboard();

// Get user stats
const stats = await leaderboardAPI.getUserStats();

// Track content share
await leaderboardAPI.shareContent('post', postId, 'external');

// Story interactions
await leaderboardAPI.likeStory(storyId);
await leaderboardAPI.commentOnStory(storyId, content);
```

### 🎣 React Hook (`hooks/useLeaderboard.ts`)
```typescript
const {
  leaderboard,
  userStats,
  userRewards,
  loading,
  refresh,
  shareContent,
  likeStory
} = useLeaderboard();
```

## Setup Instructions

### 1. Database Setup
```sql
-- Run the leaderboard schema
\i sql/leaderboard_schema.sql

-- Run the leaderboard functions
\i sql/leaderboard_functions.sql

-- Or use the combined setup script
\i scripts/setup-leaderboard.sql
```

### 2. Verify Installation
```sql
-- Check tables
SELECT tablename FROM pg_tables 
WHERE tablename LIKE '%leaderboard%' OR tablename LIKE '%engagement%';

-- Check functions
SELECT proname FROM pg_proc 
WHERE proname LIKE '%leaderboard%';

-- Test current period
SELECT * FROM get_current_leaderboard_period();
```

### 3. Frontend Integration
The leaderboard is already integrated into the sidebar. Users can access it by:
1. Opening the sidebar
2. Tapping "🏆 Leaderboard"
3. Viewing rankings, stats, and rewards

## How It Works

### 📈 Point Tracking Flow
1. **User Engagement**: User likes, comments, or shares content
2. **Trigger Activation**: Database triggers fire automatically
3. **Point Calculation**: Points calculated based on engagement type
4. **Ranking Update**: Leaderboard rankings refreshed
5. **Real-time Display**: UI shows updated rankings and stats

### 🔄 Weekly Cycle
1. **Period Creation**: New period starts every Monday
2. **Point Accumulation**: Users earn points throughout the week
3. **Dynamic Rankings**: Top 50 updated in real-time
4. **Period Completion**: Sunday night, rewards distributed
5. **Reset**: New period begins, rankings reset

### 🏅 Reward Distribution
At the end of each week:
1. Final rankings calculated
2. Rewards assigned based on position
3. Badges and titles granted
4. New period automatically starts

## Performance Optimizations

### 🚀 Database Optimizations
- **Indexes**: Comprehensive indexing for fast queries
- **RLS Policies**: Row-level security for data protection
- **Efficient Triggers**: Minimal overhead for point tracking
- **Batch Updates**: Optimized ranking calculations

### 📱 Frontend Optimizations
- **Lazy Loading**: Components load data on demand
- **Caching**: API responses cached for performance
- **Optimistic Updates**: UI updates before API confirmation
- **Error Handling**: Graceful fallbacks for failed operations

## Testing

### 🧪 Test Scenarios
1. **Basic Engagement**: Like/comment/share content
2. **Point Calculation**: Verify correct point allocation
3. **Ranking Updates**: Check real-time ranking changes
4. **Period Transitions**: Test weekly period changes
5. **Reward Distribution**: Verify reward assignment

### 📊 Monitoring
- Monitor engagement_points table growth
- Check leaderboard_rankings updates
- Verify trigger performance
- Track user engagement metrics

## Future Enhancements

### 🔮 Potential Features
- **Multiple Leaderboards**: Daily, monthly, all-time
- **Category Leaderboards**: Separate for posts, reels, stories
- **Bonus Multipliers**: Special events with extra points
- **Achievement System**: Milestone-based achievements
- **Social Features**: Follow top performers
- **Analytics Dashboard**: Detailed engagement analytics

### 🛠 Technical Improvements
- **Real-time Updates**: WebSocket integration for live updates
- **Advanced Caching**: Redis caching for leaderboard data
- **Push Notifications**: Notify users of rank changes
- **Export Features**: Download leaderboard data
- **Admin Panel**: Manage periods and rewards

## Troubleshooting

### 🐛 Common Issues
1. **Missing Points**: Check trigger functionality
2. **Ranking Delays**: Verify update_leaderboard_rankings calls
3. **Period Issues**: Ensure get_current_leaderboard_period works
4. **Permission Errors**: Check RLS policies and grants

### 🔧 Debug Queries
```sql
-- Check current period
SELECT * FROM leaderboard_periods WHERE is_active = true;

-- View user points
SELECT * FROM engagement_points WHERE user_id = 'USER_ID';

-- Check rankings
SELECT * FROM leaderboard_rankings ORDER BY rank_position;

-- Verify triggers
SELECT * FROM information_schema.triggers WHERE trigger_name LIKE '%points%';
```

## Conclusion

The leaderboard system is now fully implemented and ready for use. It provides a comprehensive engagement tracking and ranking system that encourages user participation while maintaining high performance and reliability.

For support or questions, refer to the API documentation in `lib/leaderboardApi.ts` and the component documentation in `components/Leaderboard.tsx`.
