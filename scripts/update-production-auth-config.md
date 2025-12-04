# Production Email Verification Setup Guide

## Current Issue
Email verification redirects to `https://klicktape.com` instead of a proper verification page that can deep link back to your app.

## Production Setup Steps

### Step 1: Update Supabase Production Configuration

1. **Access Supabase Dashboard**
   - Go to: https://app.supabase.com/project/wpxkjqfcoudcddluiiab
   - Navigate to **Authentication** → **URL Configuration**

2. **Update Site URL**
   - Set **Site URL** to: `https://klicktape.com`

3. **Add Redirect URLs**
   Add these URLs to the **"Redirect URLs"** section:
   ```
   https://klicktape.com/verify-email.html
   https://klicktape.com/auth/verified
   klicktape://auth/verified
   ```

4. **Save Configuration**
   - Click **Save** to apply changes
   - Changes take effect immediately

### Step 2: Deploy Verification Page

1. **Upload to Website**
   - Upload `public/verify-email-production.html` to your web server
   - Rename it to `verify-email.html`
   - Final URL should be: `https://klicktape.com/verify-email.html`

2. **Verify File Access**
   - Test that `https://klicktape.com/verify-email.html` loads correctly
   - Ensure it's accessible without authentication

### Step 3: Configure App Store Deep Links (Optional)

If you want to handle users who don't have the app installed:

1. **iOS Universal Links**
   - Add `apple-app-site-association` file to `https://klicktape.com/.well-known/`
   - Configure your app's URL schemes in Xcode

2. **Android App Links**
   - Add `assetlinks.json` to `https://klicktape.com/.well-known/`
   - Configure intent filters in your Android manifest

## How It Works

1. **User signs up** → App calls Supabase with `emailRedirectTo: "https://klicktape.com/verify-email.html"`
2. **User clicks email link** → Redirects to your verification page
3. **Verification page** → Confirms email with Supabase
4. **Success** → Deep links back to app with `klicktape://auth/verified`

## Testing Production Flow

1. **Sign up with new email**
   ```bash
   # Use a real email you can access
   ```

2. **Check email**
   - Should receive confirmation email
   - Link should go to `https://klicktape.com/verify-email.html?token=...`

3. **Click verification link**
   - Should load your verification page
   - Should show "Email Confirmed Successfully!"
   - Should attempt to open your app

4. **Verify app opens**
   - App should open to verified state
   - User should be logged in

## Troubleshooting

### Email still redirects to wrong URL
- Check Supabase dashboard configuration
- Ensure you saved the changes
- Clear browser cache and try again

### Verification page doesn't load
- Verify file is uploaded to correct location
- Check web server configuration
- Test direct URL access

### App doesn't open after verification
- Check deep link configuration in app
- Verify URL scheme registration
- Test deep link manually: `klicktape://auth/verified`

### User not logged in after verification
- Check Supabase session handling
- Verify token processing in verification page
- Check app's auth state management

## Security Notes

- Verification tokens are single-use and expire
- HTTPS is required for production
- Deep links should validate the source
- Consider rate limiting on verification endpoints