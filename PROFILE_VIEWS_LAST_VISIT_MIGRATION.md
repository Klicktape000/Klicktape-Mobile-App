# Profile Views "Last Visit Only" Migration

## Overview
This migration implements the "last visit only" feature for profile views, ensuring that frequent visitors only show their most recent visit instead of multiple entries.

## Problem Solved
- **Before**: Multiple profile view records for the same viewer-viewed pair
- **After**: Only the most recent visit is stored for each unique viewer-viewed pair

## Changes Made

### 1. Code Changes
- Modified `trackProfileView` function in `lib/referralApi.ts` to use UPSERT instead of duplicate prevention
- Removed 1-hour duplicate check logic
- Added `onConflict: 'viewer_id,viewed_profile_id'` to update existing records

### 2. Database Schema Changes
- Added unique constraint: `profile_views_viewer_viewed_unique`
- Constraint ensures only one record per `(viewer_id, viewed_profile_id)` pair

## Migration Steps

### Step 1: Apply Database Migration
Run the SQL script in Supabase SQL Editor:

```bash
# File: add-profile-views-unique-constraint.sql
```

**What this script does:**
1. Removes duplicate records, keeping only the most recent view
2. Adds unique constraint to prevent future duplicates
3. Verifies the constraint was added successfully
4. Provides verification queries

### Step 2: Verify Migration Success
After running the migration, check:

1. **No duplicates remain:**
   ```sql
   SELECT viewer_id, viewed_profile_id, COUNT(*) as duplicate_count
   FROM profile_views 
   GROUP BY viewer_id, viewed_profile_id 
   HAVING COUNT(*) > 1;
   ```
   Should return 0 rows.

2. **Constraint exists:**
   ```sql
   SELECT conname, pg_get_constraintdef(oid) 
   FROM pg_constraint 
   WHERE conrelid = 'profile_views'::regclass 
     AND conname = 'profile_views_viewer_viewed_unique';
   ```

### Step 3: Test the New Functionality
1. Restart your Expo development server
2. Navigate to different user profiles multiple times
3. Verify that only the latest visit timestamp is shown

## Expected Behavior

### Before Migration
```
User A views User B's profile at 10:00 AM
User A views User B's profile at 11:00 AM
User A views User B's profile at 12:00 PM

Result: 3 separate profile view records
```

### After Migration
```
User A views User B's profile at 10:00 AM
User A views User B's profile at 11:00 AM  → Updates existing record
User A views User B's profile at 12:00 PM  → Updates existing record

Result: 1 profile view record with timestamp 12:00 PM
```

## Technical Details

### UPSERT Logic
```typescript
await supabase
  .from('profile_views')
  .upsert({
    viewer_id: viewerId,
    viewed_profile_id: viewedProfileId,
    is_anonymous: isAnonymous,
    viewed_at: new Date().toISOString()
  }, {
    onConflict: 'viewer_id,viewed_profile_id',
    ignoreDuplicates: false // Always update the viewed_at timestamp
  });
```

### Database Constraint
```sql
ALTER TABLE profile_views 
ADD CONSTRAINT profile_views_viewer_viewed_unique 
UNIQUE (viewer_id, viewed_profile_id);
```

## Rollback Plan (if needed)

If you need to rollback this migration:

1. **Remove the unique constraint:**
   ```sql
   ALTER TABLE profile_views 
   DROP CONSTRAINT profile_views_viewer_viewed_unique;
   ```

2. **Revert code changes:**
   - Restore the original `trackProfileView` function with duplicate prevention logic

## Testing Checklist

- [ ] Migration script runs without errors
- [ ] No duplicate records remain in `profile_views` table
- [ ] Unique constraint is properly added
- [ ] Profile view tracking still works correctly
- [ ] Only latest visit timestamp is shown for frequent visitors
- [ ] Premium users can still see who viewed their profile
- [ ] Profile view analytics still work correctly

## Notes

- This migration is **irreversible** in terms of data - duplicate records will be permanently removed
- The migration keeps the **most recent** view for each viewer-viewed pair
- Existing RLS policies remain unchanged
- Premium feature functionality is preserved

## Support

If you encounter any issues:
1. Check the Supabase logs for constraint violation errors
2. Verify the unique constraint was added correctly
3. Ensure the code changes are properly deployed
4. Test with different user accounts to verify functionality