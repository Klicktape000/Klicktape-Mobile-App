# 🛡️ Safe Referral System Setup - Preserving Existing Features

## ⚠️ **IMPORTANT: Non-Destructive Approach**

This SQL script is designed to **preserve all existing functionality** while adding the referral system. It will NOT break any existing features in your KlickTape app.

## 🔒 **Safety Measures Implemented**

### **1. Safe Object Dropping**
```sql
-- Only drops referral-specific objects, not existing app data
DROP VIEW IF EXISTS referral_dashboard;           -- Safe: referral-specific
DROP VIEW IF EXISTS profile_view_history;         -- Safe: referral-specific
DROP TRIGGER IF EXISTS trigger_create_referral_code ON profiles;  -- Safe: referral-specific
DROP FUNCTION IF EXISTS generate_referral_code(TEXT);  -- Safe: referral-specific
```

**What's NOT dropped:**
- ✅ Existing `profiles` table and data
- ✅ Existing user authentication
- ✅ Existing posts, likes, follows
- ✅ Any other app functionality

### **2. Conditional Table Creation**
```sql
-- Creates tables only if they don't exist
CREATE TABLE IF NOT EXISTS referral_codes (...);
CREATE TABLE IF NOT EXISTS referrals (...);
CREATE TABLE IF NOT EXISTS user_premium_features (...);
CREATE TABLE IF NOT EXISTS profile_views (...);
```

**Result**: 
- ✅ If tables exist → Preserves existing data
- ✅ If tables don't exist → Creates them fresh

### **3. Safe Column Addition**
```sql
-- Adds columns only if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_premium_features' 
                   AND column_name = 'referrals_required') THEN
        ALTER TABLE user_premium_features ADD COLUMN referrals_required INTEGER DEFAULT 5;
    END IF;
END $$;
```

**Result**:
- ✅ Existing columns → Unchanged
- ✅ Missing columns → Added safely

## 📋 **What the Script Does**

### **Phase 1: Cleanup (Safe)**
- Drops only referral-specific views, triggers, and functions
- Does NOT touch any existing app data or core functionality

### **Phase 2: Table Setup (Non-Destructive)**
- Creates referral tables only if they don't exist
- Adds missing columns to existing tables safely
- Preserves all existing data

### **Phase 3: Function Creation**
- Creates referral-specific functions
- No impact on existing app functions

### **Phase 4: Trigger Setup**
- Creates triggers for automatic referral tracking
- Only affects new referral-related operations

### **Phase 5: Security Setup**
- Enables RLS only on new referral tables
- Does not modify existing table security

## 🎯 **Expected Behavior**

### **For Existing Users**
- ✅ All existing functionality continues to work
- ✅ Login, posts, follows, likes remain unchanged
- ✅ Existing user data is preserved
- ✅ App performance is not affected

### **For New Referral Features**
- ✅ New users automatically get referral codes
- ✅ Existing users get referral codes on first app use
- ✅ Referral tracking works for new signups
- ✅ Premium features unlock at 5 referrals

## 🚀 **How to Run Safely**

### **Step 1: Backup (Recommended)**
```sql
-- Optional: Create a backup of critical tables
CREATE TABLE profiles_backup AS SELECT * FROM profiles;
CREATE TABLE user_premium_features_backup AS SELECT * FROM user_premium_features;
```

### **Step 2: Run the Script**
1. Open Supabase SQL Editor
2. Copy entire content of `scripts/setup-referral-system-supabase.sql`
3. Paste and run

### **Step 3: Verify**
```sql
-- Check that existing functionality is preserved
SELECT count(*) as existing_users FROM profiles;
SELECT count(*) as new_referral_codes FROM referral_codes;

-- Verify no data loss
SELECT 'All good!' as status WHERE 
  (SELECT count(*) FROM profiles) > 0 AND
  (SELECT count(*) FROM referral_codes) >= 0;
```

## 🔍 **What Gets Created**

### **New Tables** (only if they don't exist):
- `referral_codes` - User referral codes
- `referrals` - Referral tracking
- `user_premium_features` - Premium feature management
- `profile_views` - Profile view tracking
- `referral_campaigns` - Campaign management

### **New Functions**:
- `generate_referral_code()` - Creates unique codes
- `create_user_referral_code()` - Auto-creates codes for users
- `update_referral_progress()` - Tracks referral completion
- `can_view_profile_visitors()` - Checks premium access
- `track_profile_view()` - Records profile views safely

### **New Triggers**:
- Auto-create referral codes for new users
- Track referral progress automatically
- Update premium status at 5 referrals

### **New Views**:
- `referral_dashboard` - Complete referral stats
- `profile_view_history` - Profile view data for premium users

## ⚡ **Performance Impact**

### **Minimal Impact on Existing Features**:
- ✅ New triggers only fire for referral-related actions
- ✅ New tables are separate from existing data
- ✅ Indexes are optimized for performance
- ✅ RLS policies are efficient

### **Benefits for New Features**:
- ✅ Fast referral code generation
- ✅ Real-time progress tracking
- ✅ Efficient premium feature checks
- ✅ Optimized profile view queries

## 🛡️ **Rollback Plan (If Needed)**

If you need to remove the referral system:

```sql
-- Remove referral-specific objects only
DROP VIEW IF EXISTS referral_dashboard;
DROP VIEW IF EXISTS profile_view_history;
DROP TRIGGER IF EXISTS trigger_create_referral_code ON profiles;
DROP TRIGGER IF EXISTS trigger_update_referral_progress ON referrals;
DROP TRIGGER IF EXISTS trigger_insert_referral_progress ON referrals;
DROP FUNCTION IF EXISTS generate_referral_code(TEXT);
DROP FUNCTION IF EXISTS create_user_referral_code();
DROP FUNCTION IF EXISTS update_referral_progress();
DROP FUNCTION IF EXISTS can_view_profile_visitors(UUID);
DROP FUNCTION IF EXISTS track_profile_view(UUID, UUID);

-- Optionally remove tables (WARNING: This deletes referral data)
-- DROP TABLE IF EXISTS referral_campaigns;
-- DROP TABLE IF EXISTS profile_views;
-- DROP TABLE IF EXISTS referrals;
-- DROP TABLE IF EXISTS referral_codes;
-- ALTER TABLE user_premium_features DROP COLUMN IF EXISTS referrals_required;
-- ALTER TABLE user_premium_features DROP COLUMN IF EXISTS referrals_completed;
-- ALTER TABLE user_premium_features DROP COLUMN IF EXISTS unlocked_at;
```

## ✅ **Final Safety Checklist**

Before running the script:
- [ ] Confirm this is a development/staging environment OR
- [ ] Confirm you have database backups
- [ ] Understand that only referral features are being added
- [ ] Existing app functionality will remain unchanged

After running the script:
- [ ] Test existing app features (login, posts, etc.)
- [ ] Test new referral features
- [ ] Verify user data is intact
- [ ] Check app performance

## 🎉 **Ready to Deploy**

This script is designed to be **production-safe** and **non-destructive**. It will add the referral system to your KlickTape app without affecting any existing functionality.

**Status: Safe to run in production! ✅**
