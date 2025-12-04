# 🔧 Supabase Configuration for Email Verification

## 🎯 Critical Configuration Required

After adding the verification page to your Firebase project, you **MUST** update your Supabase configuration for email verification to work properly.

## 📍 Step-by-Step Supabase Setup

### Step 1: Access Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Sign in to your account
3. Select your KlickTape project

### Step 2: Navigate to Authentication Settings

1. In the left sidebar, click **Authentication**
2. Click **URL Configuration** tab

### Step 3: Update Site URL

Set the **Site URL** to:
```
https://klicktape.com
```

### Step 4: Add Redirect URLs

In the **Redirect URLs** section, add these URLs (one per line):

```
https://klicktape.com/verify-email.html
https://klicktape.com/verify-email
klicktape://auth/verified
```

**Important Notes:**
- ✅ Add each URL on a separate line
- ✅ Include both `/verify-email.html` and `/verify-email` 
- ✅ Include the deep link for mobile app
- ✅ Make sure there are no extra spaces or characters

### Step 5: Save Configuration

1. Click **Save** at the bottom of the page
2. Wait for the "Settings saved" confirmation

## 🔍 Verification Checklist

After saving, verify your configuration:

### Site URL ✅
- [ ] Set to: `https://klicktape.com`

### Redirect URLs ✅
- [ ] `https://klicktape.com/verify-email.html`
- [ ] `https://klicktape.com/verify-email`  
- [ ] `klicktape://auth/verified`

## 🧪 Test Your Configuration

### Test 1: Email Verification Flow

1. **Sign up** with a new email in your KlickTape app
2. **Check email** for verification link
3. **Click the link** - should redirect to your Firebase page
4. **Verify redirect** - page should load successfully
5. **Check deep link** - should attempt to open your app

### Test 2: Manual URL Test

Visit these URLs directly:
- `https://klicktape.com/verify-email.html` ✅ Should load
- `https://klicktape.com/verify-email` ✅ Should redirect to .html

### Test 3: Deep Link Test

Test the deep link manually:
```
klicktape://auth/verified
```
Should open your mobile app (if installed).

## 🚨 Common Issues & Solutions

### Issue: "Invalid redirect URL" error

**Cause:** Redirect URL not properly configured in Supabase

**Solution:**
1. Double-check the exact URLs in Supabase settings
2. Ensure no extra spaces or characters
3. Make sure the URLs match exactly: `https://klicktape.com/verify-email.html`

### Issue: Email link redirects to wrong page

**Cause:** Site URL not set correctly

**Solution:**
1. Set Site URL to: `https://klicktape.com`
2. Save and wait a few minutes for changes to propagate

### Issue: Verification page shows "Invalid token"

**Cause:** Token expired or malformed

**Solution:**
1. Request a new verification email
2. Click the link immediately (tokens expire)
3. Check that the Supabase URL in verify-email.html is correct

### Issue: App doesn't open after verification

**Cause:** Deep link not configured properly

**Solution:**
1. Verify `klicktape://auth/verified` is in Supabase redirect URLs
2. Check your mobile app's URL scheme configuration
3. Test deep link manually

## 📱 Mobile App Deep Link Setup

### iOS Configuration

Add to your `Info.plist`:
```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>klicktape</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>klicktape</string>
        </array>
    </dict>
</array>
```

### Android Configuration

Add to your `AndroidManifest.xml`:
```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="klicktape" />
</intent-filter>
```

### React Native / Expo Configuration

In your `app.config.js` or `app.json`:
```javascript
{
  "expo": {
    "scheme": "klicktape"
  }
}
```

## 🔄 Email Template Customization (Optional)

### Custom Email Templates

1. In Supabase Dashboard → **Authentication** → **Email Templates**
2. Customize the **Confirm signup** template
3. Use these variables:
   - `{{ .ConfirmationURL }}` - The verification link
   - `{{ .SiteURL }}` - Your site URL
   - `{{ .Email }}` - User's email

### Example Custom Template

```html
<h2>Welcome to KlickTape!</h2>
<p>Thanks for signing up! Please click the link below to verify your email:</p>
<p><a href="{{ .ConfirmationURL }}">Verify Email Address</a></p>
<p>If you didn't create an account, you can safely ignore this email.</p>
```

## 📊 Monitoring & Analytics

### Supabase Analytics

Monitor email verification in:
1. **Authentication** → **Users** (see verified status)
2. **Authentication** → **Logs** (see auth events)

### Firebase Analytics

Track verification page visits in:
1. **Analytics** → **Events** (page_view events)
2. **Hosting** → **Usage** (bandwidth and requests)

## 🔒 Security Best Practices

### Current Security Features ✅

- ✅ **HTTPS only** - All URLs use secure connections
- ✅ **Token validation** - Supabase validates all tokens
- ✅ **No sensitive data** - No secrets in client code
- ✅ **Rate limiting** - Supabase handles rate limiting

### Additional Security (Optional)

- Consider adding CAPTCHA for repeated failures
- Implement IP-based rate limiting
- Add Content Security Policy headers

## ✅ Final Verification

After completing all steps:

1. **Configuration saved** ✅
2. **URLs accessible** ✅  
3. **Email flow tested** ✅
4. **Deep link working** ✅
5. **Mobile app opens** ✅

## 🎉 Success!

Your email verification system is now:
- ✅ **Fully configured** in Supabase
- ✅ **Hosted** on your Firebase project
- ✅ **Mobile app integrated**
- ✅ **Production ready**

**Next:** Test with real users and monitor the verification flow!

## 📞 Support

If you need help:
1. Check Supabase logs for auth events
2. Review Firebase Console for hosting issues
3. Test with browser developer tools open
4. Verify all URLs are exactly as specified