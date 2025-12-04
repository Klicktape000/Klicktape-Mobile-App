# 🗑️ User Deletion & Email Reuse Guide

## 🔍 Problem: Can't Create New Account with Deleted User's Email

### **Why This Happens**

When you delete a user from your database, Supabase Auth maintains an internal record to prevent:
- **Email reuse attacks** - Unauthorized access to deleted accounts
- **Spam prevention** - Users signing up repeatedly without verification
- **Security** - Ensuring proper cleanup before email reuse

---

## 📊 Current Configuration

Your Supabase Auth settings:
- ✅ `mailer_allow_unverified_email_sign_ins: false` (Secure - prevents unverified email reuse)
- ✅ `mailer_autoconfirm: false` (Requires email verification)
- ✅ `disable_signup: false` (Signups enabled)

**This is the correct security configuration!** The issue is likely in how users are being deleted.

---

## 🔧 How User Deletion Works in Klicktape

### **Two Tables to Consider:**

1. **`public.profiles`** - Your app's user data
   - Contains: username, avatar, bio, etc.
   - Visible in Supabase Dashboard → Table Editor

2. **`auth.users`** - Supabase's authentication system
   - Contains: email, password hash, verification status
   - Visible in Supabase Dashboard → Authentication → Users

**IMPORTANT:** You must delete from BOTH tables to allow email reuse!

---

## ✅ Correct Deletion Methods

### **Method 1: Use the App's Delete Account Feature (RECOMMENDED)**

Your app has a proper deletion flow in `app/(root)/settings.tsx`:

```typescript
// This calls the Edge Function which deletes from BOTH tables
const { data, error } = await supabase.functions.invoke('delete-user', {
  headers: {
    Authorization: `Bearer ${sessionData.session.access_token}`
  }
});
```

**What it does:**
1. ✅ Deletes from `profiles` table
2. ✅ Deletes from `posts`, `comments`, `likes`, etc.
3. ✅ Deletes from `auth.users` using admin privileges
4. ✅ Allows email to be reused immediately

**How to use:**
1. Sign in to the app
2. Go to Settings → Account
3. Click "Delete Account"
4. Confirm deletion
5. Email is now available for reuse

---

### **Method 2: Use Supabase Dashboard (For Testing)**

**Step 1: Delete from Authentication**
1. Go to **Supabase Dashboard**
2. Navigate to **Authentication** → **Users**
3. Find the user by email
4. Click **three dots (⋮)** → **Delete User**
5. Confirm deletion

**Step 2: Delete from Profiles Table**
1. Go to **Table Editor** → **profiles**
2. Find the user's profile
3. Click **three dots (⋮)** → **Delete**
4. Confirm deletion

**Order matters!** Delete from `auth.users` first, then `profiles`.

---

### **Method 3: Use SQL (For Bulk Operations)**

Run this in **Supabase SQL Editor**:

```sql
-- Replace 'user@example.com' with the actual email
DO $$
DECLARE
    user_id_to_delete UUID;
BEGIN
    -- Get the user ID from auth.users
    SELECT id INTO user_id_to_delete
    FROM auth.users
    WHERE email = 'user@example.com';

    -- Delete from profiles table
    DELETE FROM public.profiles WHERE id = user_id_to_delete;

    -- Delete from auth.users
    DELETE FROM auth.users WHERE id = user_id_to_delete;

    RAISE NOTICE 'User deleted successfully: %', user_id_to_delete;
END $$;
```

---

## ❌ Incorrect Deletion Methods (DON'T DO THIS)

### **❌ Only Deleting from Profiles Table**
```sql
-- This DOES NOT free up the email!
DELETE FROM profiles WHERE email = 'user@example.com';
```
**Problem:** User still exists in `auth.users`, email is blocked.

### **❌ Only Deleting from Supabase Dashboard → Table Editor**
**Problem:** Only deletes from `profiles`, not from `auth.users`.

---

## 🔍 How to Check if User is Fully Deleted

### **Check Auth System**

Run this SQL query in **Supabase SQL Editor**:

```sql
-- Replace with the email you're checking
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    deleted_at
FROM auth.users
WHERE email = 'user@example.com';
```

**Results:**
- ✅ **No rows returned** → User is fully deleted, email can be reused
- ❌ **Row returned** → User still exists in auth system, email is blocked

### **Check Profiles Table**

```sql
SELECT * FROM profiles WHERE email = 'user@example.com';
```

**Results:**
- ✅ **No rows returned** → Profile deleted
- ❌ **Row returned** → Profile still exists

---

## 🛠️ Troubleshooting

### **Issue 1: "User already registered" Error**

**Symptoms:**
- Trying to sign up with deleted user's email
- Getting error: "User already registered" or "Email already in use"

**Solution:**
1. Check if user exists in `auth.users` (see SQL above)
2. If user exists, delete using Method 2 or 3
3. If user doesn't exist, wait 5 minutes for cache to clear
4. Try signing up again

---

### **Issue 2: User Deleted from Dashboard but Email Still Blocked**

**Cause:** You only deleted from `profiles` table, not from `auth.users`.

**Solution:**
1. Go to **Authentication** → **Users** in Supabase Dashboard
2. Find and delete the user there
3. Email will be immediately available

---

### **Issue 3: Edge Function Deletion Not Working**

**Symptoms:**
- Used app's "Delete Account" feature
- Email still blocked

**Diagnosis:**
Check Edge Function logs:
1. Go to **Supabase Dashboard** → **Edge Functions** → **delete-user**
2. Check logs for errors
3. Look for "Error deleting user from auth.users"

**Common causes:**
- Service role key not configured
- Insufficient permissions
- Network timeout

**Solution:**
Verify environment variables in Edge Function:
```bash
supabase secrets list
```

Should show:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` ← This is critical!

---

## 🔐 Security Considerations

### **Why We Don't Allow Immediate Email Reuse by Default**

1. **Account Takeover Prevention**
   - Prevents someone from quickly recreating a deleted account
   - Gives original owner time to recover if deletion was accidental

2. **Audit Trail**
   - Maintains deletion history for compliance
   - Helps track abuse patterns

3. **Data Integrity**
   - Ensures all related data is properly cleaned up
   - Prevents orphaned records

### **When to Allow Immediate Email Reuse**

✅ **Development/Testing** - Frequently creating/deleting test accounts  
✅ **User Request** - User wants to recreate account immediately  
✅ **Admin Action** - Manual cleanup of spam/test accounts  

---

## 📝 Best Practices

### **For Development**

1. **Use unique test emails:**
   ```
   test+1@example.com
   test+2@example.com
   test+3@example.com
   ```
   Gmail ignores the `+` part, so all go to `test@example.com`

2. **Use temporary email services:**
   - [Mailinator](https://www.mailinator.com/)
   - [TempMail](https://temp-mail.org/)
   - [10MinuteMail](https://10minutemail.com/)

3. **Create a cleanup script:**
   ```sql
   -- Delete all test users (run periodically)
   DELETE FROM auth.users WHERE email LIKE '%+test%';
   DELETE FROM profiles WHERE email LIKE '%+test%';
   ```

### **For Production**

1. **Always use the Edge Function** for user deletion
2. **Log all deletions** for audit purposes
3. **Implement soft deletes** for critical data
4. **Add confirmation dialogs** before deletion
5. **Send confirmation emails** after deletion

---

## 🚀 Quick Reference

### **To Delete a User Completely:**

**Option A: Via App (Recommended)**
```
Settings → Delete Account → Confirm
```

**Option B: Via Dashboard**
```
1. Authentication → Users → Delete User
2. Table Editor → profiles → Delete Row
```

**Option C: Via SQL**
```sql
DELETE FROM auth.users WHERE email = 'user@example.com';
DELETE FROM profiles WHERE email = 'user@example.com';
```

### **To Check if Email is Available:**

```sql
SELECT email FROM auth.users WHERE email = 'user@example.com';
-- No results = Email available
```

### **To Manually Free Up an Email:**

```sql
-- Run in Supabase SQL Editor
DELETE FROM auth.users WHERE email = 'user@example.com';
```

---

## 📚 Related Files

- **Edge Function:** `supabase/functions/delete-user/index.ts`
- **Settings Page:** `app/(root)/settings.tsx`
- **SQL Function:** `sql/delete_user_function.sql`
- **Check Script:** `scripts/check-user-in-auth.sql`

---

## ✅ Summary

**The Issue:**
Deleting a user from the `profiles` table doesn't free up their email because they still exist in `auth.users`.

**The Solution:**
Always delete from BOTH `auth.users` AND `profiles` table using:
1. The app's built-in delete function (recommended)
2. Supabase Dashboard → Authentication → Users
3. SQL script that deletes from both tables

**After Proper Deletion:**
Email is immediately available for reuse! 🎉

---

**Last Updated:** 2025-10-30  
**Related Issue:** Email reuse after user deletion

