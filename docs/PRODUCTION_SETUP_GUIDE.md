# KlickTape Production Setup Guide

## 🚀 Production Deployment Steps

### Prerequisites
- Supabase account with a new project created
- Access to Supabase dashboard and SQL editor
- KlickTape application code ready for deployment

### Step 1: Create Supabase Production Project

1. **Go to [Supabase Dashboard](https://app.supabase.com)**
2. **Click "New Project"**
3. **Configure Project:**
   - Organization: Select your organization
   - Name: `klicktape-production`
   - Database Password: Generate a strong password
   - Region: Choose closest to your users
   - Pricing Plan: Select appropriate plan

4. **Wait for project initialization** (2-3 minutes)

### Step 2: Deploy Database Schema

#### Option A: Using SQL Editor (Recommended)
1. **Open Supabase Dashboard → SQL Editor**
2. **Create new query**
3. **Copy and paste the following files in order:**

   **First: Main Schema**
   ```sql
   -- Copy entire content from: docs/klicktape_database_schema.sql
   ```

   **Second: Leaderboard Schema**
   ```sql
   -- Copy entire content from: sql/leaderboard_schema.sql
   ```

4. **Run each script separately**
5. **Verify successful execution**

#### Option B: Using Supabase CLI
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your production project
supabase link --project-ref YOUR_PROJECT_REF

# Push database changes
supabase db push
```

### Step 3: Configure Application Environment

#### Get Production Credentials
1. **Go to Project Settings → API**
2. **Copy the following values:**
   - Project URL: `https://YOUR_PROJECT_REF.supabase.co`
   - Anon (public) key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Service role key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

#### Update Environment Variables
Create/update your production environment file:

```env
# Production Environment Variables
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Optional: Custom domain
EXPO_PUBLIC_SUPABASE_URL=https://api.klicktape.com
```

### Step 4: Configure Storage Buckets

1. **Go to Storage in Supabase Dashboard**
2. **Create the following buckets:**

   **Posts Bucket:**
   ```sql
   INSERT INTO storage.buckets (id, name, public)
   VALUES ('posts', 'posts', true);
   ```

   **Reels Bucket:**
   ```sql
   INSERT INTO storage.buckets (id, name, public)
   VALUES ('reels', 'reels', true);
   ```

   **Stories Bucket:**
   ```sql
   INSERT INTO storage.buckets (id, name, public)
   VALUES ('stories', 'stories', true);
   ```

   **Avatars Bucket:**
   ```sql
   INSERT INTO storage.buckets (id, name, public)
   VALUES ('avatars', 'avatars', true);
   ```

3. **Set up Storage Policies:**
   ```sql
   -- Allow authenticated users to upload
   CREATE POLICY "Allow authenticated uploads" ON storage.objects
   FOR INSERT WITH CHECK (auth.role() = 'authenticated');

   -- Allow public read access
   CREATE POLICY "Allow public downloads" ON storage.objects
   FOR SELECT USING (true);

   -- Allow users to update their own files
   CREATE POLICY "Allow users to update own files" ON storage.objects
   FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);
   ```

### Step 5: Configure Authentication

1. **Go to Authentication → Settings**
2. **Configure Site URL:**
   - Site URL: `https://your-app-domain.com`
   - Redirect URLs: Add your app's deep link URLs

3. **Enable Auth Providers:**
   - Email/Password: ✅ Enabled
   - Google: Configure if needed
   - Apple: Configure if needed
   - Phone: Configure if needed

4. **Email Templates:**
   - Customize confirmation and reset password emails
   - Add your app branding

### Step 6: Security Configuration

#### Database Security
1. **Verify RLS is enabled on all tables**
2. **Test RLS policies with different user contexts**
3. **Review and audit all policies**

#### API Security
1. **Configure CORS settings**
2. **Set up rate limiting**
3. **Review API access patterns**

### Step 7: Performance Optimization

#### Database Optimization
1. **Monitor query performance**
2. **Add additional indexes if needed**
3. **Set up connection pooling**

#### CDN Configuration
1. **Configure CDN for storage buckets**
2. **Set up image optimization**
3. **Configure caching headers**

### Step 8: Monitoring and Logging

1. **Enable Database Logs**
2. **Set up Error Tracking**
3. **Configure Performance Monitoring**
4. **Set up Alerts for:**
   - High database usage
   - Storage quota limits
   - Authentication failures
   - API rate limits

### Step 9: Testing Production Setup

#### Database Tests
```sql
-- Test user creation
INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'test@example.com');

-- Test profile creation
INSERT INTO profiles (id, username, email) 
VALUES (auth.uid(), 'testuser', 'test@example.com');

-- Test post creation
INSERT INTO posts (user_id, caption) 
VALUES (auth.uid(), 'Test post');

-- Verify RLS policies
SELECT * FROM posts; -- Should only show user's posts
```

#### Application Tests
1. **User Registration/Login**
2. **Profile Creation/Update**
3. **Post Creation/Upload**
4. **Social Features (likes, follows, comments)**
5. **Real-time Features (messaging, notifications)**

### Step 10: Go Live Checklist

- [ ] Database schema deployed successfully
- [ ] All tables and indexes created
- [ ] RLS policies active and tested
- [ ] Storage buckets configured
- [ ] Authentication working
- [ ] Environment variables updated
- [ ] Application tested in production
- [ ] Monitoring and alerts configured
- [ ] Backup strategy in place
- [ ] SSL certificates configured
- [ ] Domain configured (if using custom domain)

## 🔧 Troubleshooting

### Common Issues

**Schema Deployment Fails:**
- Check for syntax errors in SQL
- Verify extensions are available
- Run scripts in correct order

**RLS Policies Not Working:**
- Verify RLS is enabled on tables
- Check policy conditions
- Test with different user contexts

**Storage Upload Fails:**
- Check bucket policies
- Verify authentication
- Check file size limits

**Performance Issues:**
- Review query patterns
- Add missing indexes
- Check connection pooling

## 📞 Support

- **Supabase Documentation:** https://supabase.com/docs
- **Supabase Discord:** https://discord.supabase.com
- **GitHub Issues:** Create issues in your repository

---

**Ready for Production! 🎉**
