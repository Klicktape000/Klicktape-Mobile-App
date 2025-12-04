# Fix Profile Views RLS Error

## Problem
You're getting this error when tracking profile views:
```
ERROR: new row violates row-level security policy for table "profile_views"
```

## Solution
The `profile_views` table needs proper RLS (Row Level Security) policies to allow users to insert and select profile view records.

## How to Apply the Fix

### Step 1: Open Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar

### Step 2: Run the Fix Script
1. Copy the entire contents of `fix-profile-views-rls.sql`
2. Paste it into the SQL Editor
3. Click **Run** to execute the script

### Step 3: Verify the Fix
The script will automatically verify that:
- ✅ RLS is enabled on `profile_views` table
- ✅ 3 policies are created:
  - `Users can insert their own profile views` (INSERT)
  - `Users can view who viewed their profile` (SELECT) 
  - `Users can view their own viewing history` (SELECT)

### Step 4: Test in Your App
1. Navigate to any user profile in your app
2. The profile view should now track successfully without errors
3. Check the browser console - you should see "Profile view tracked successfully" without any RLS errors

## What These Policies Do

1. **INSERT Policy**: Allows users to track when they view someone else's profile
   - Only allows inserting records where `viewer_id = auth.uid()`
   
2. **SELECT Policy 1**: Allows users to see who viewed their profile (premium feature)
   - Only shows records where `viewed_profile_id = auth.uid()`
   
3. **SELECT Policy 2**: Allows users to see their own viewing history
   - Only shows records where `viewer_id = auth.uid()`

## Expected Result
After applying this fix:
- ✅ No more "new row violates row-level security policy" errors
- ✅ Profile views will be tracked successfully
- ✅ Users can view their profile viewers (if they have premium access)
- ✅ The profile view analytics will work correctly

## Troubleshooting
If you still see errors after applying the fix:
1. Make sure you ran the entire SQL script in Supabase
2. Check that all 3 policies were created successfully
3. Verify RLS is enabled on the `profile_views` table
4. Try refreshing your app and testing again

The verification queries at the end of the SQL script will show you the current status of your RLS setup.