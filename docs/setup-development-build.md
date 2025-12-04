# Setting Up Development Build for KlickTape

## Why You Need a Development Build

**Expo Go Limitations:**
- ❌ Push notifications don't work
- ❌ Socket.IO not available
- ❌ Custom native modules restricted
- ❌ Limited debugging capabilities

**Development Build Benefits:**
- ✅ Full push notification support
- ✅ Socket.IO for real-time chat
- ✅ All native features work
- ✅ Better debugging and testing

## Setup Instructions

### Prerequisites

1. **Install EAS CLI**
   ```bash
   npm install -g @expo/eas-cli
   ```

2. **Login to Expo**
   ```bash
   eas login
   ```

3. **Configure EAS**
   ```bash
   eas build:configure
   ```

### Method 1: EAS Build (Cloud Build - Recommended)

#### Step 1: Configure eas.json
Create or update `eas.json` in your project root:

```json
{
  "cli": {
    "version": ">= 5.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleDebug"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium"
      }
    },
    "production": {
      "ios": {
        "resourceClass": "m-medium"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

#### Step 2: Build for Your Platform

**For Android:**
```bash
eas build --platform android --profile development
```

**For iOS:**
```bash
eas build --platform ios --profile development
```

**For Both:**
```bash
eas build --platform all --profile development
```

#### Step 3: Install the Build
- **Android**: Download APK and install on device
- **iOS**: Install via TestFlight or direct install

#### Step 4: Install Expo Dev Client
```bash
npx expo install expo-dev-client
```

#### Step 5: Start Development Server
```bash
npx expo start --dev-client
```

### Method 2: Local Build (If you have Android Studio/Xcode)

#### For Android:
```bash
npx expo run:android
```

#### For iOS:
```bash
npx expo run:ios
```

## Testing Push Notifications

### Step 1: Update app.config.js
Ensure your `app.config.js` has proper notification configuration:

```javascript
export default {
  expo: {
    // ... other config
    plugins: [
      [
        'expo-notifications',
        {
          icon: './assets/images/icon.png',
          color: '#ffffff',
          defaultChannel: 'default',
          sounds: [
            './assets/sounds/notification_default.wav',
            // ... other sounds
          ],
        },
      ],
      // ... other plugins
    ],
  },
};
```

### Step 2: Test on Physical Device
1. Install the development build on your phone
2. Open the app
3. Go to Settings > Test Notifications
4. Run diagnostics
5. Test push notifications

## Troubleshooting Development Build

### Common Issues

#### Build Fails
- Check `eas.json` configuration
- Ensure all dependencies are compatible
- Check Expo CLI version: `eas --version`

#### App Won't Install
- **Android**: Enable "Install from Unknown Sources"
- **iOS**: Trust the developer certificate in Settings

#### Push Notifications Still Don't Work
1. Verify you're using development build (not Expo Go)
2. Check device notification permissions
3. Run diagnostic tool in app
4. Verify Supabase edge function is deployed

### Verification Steps

#### Confirm Development Build
In your app, check if you see:
- Custom splash screen
- All native features working
- No "Expo Go" branding
- Socket.IO working for chat

#### Test Checklist
- [ ] App installed from development build
- [ ] User can log in
- [ ] Chat messages send/receive (Socket.IO working)
- [ ] Notification permissions can be requested
- [ ] Push notifications work
- [ ] All app features functional

## Alternative: Quick Test Setup

If you want to quickly test without building:

### Use Expo Development Build Template
```bash
npx create-expo-app --template
# Choose "Blank (TypeScript)" with development build
```

Then copy your source code to the new project.

## Production Considerations

### When Ready for Production
1. **Build production version:**
   ```bash
   eas build --platform all --profile production
   ```

2. **Submit to stores:**
   ```bash
   eas submit --platform all
   ```

3. **Configure push notification certificates**
4. **Set up production Supabase environment**

## Next Steps After Development Build

1. **Install development build on your device**
2. **Test push notifications using the diagnostic tool**
3. **Verify Socket.IO chat functionality**
4. **Test all app features**
5. **Deploy Supabase edge functions if not done**
6. **Configure EXPO_ACCESS_TOKEN in Supabase**

## Getting Help

If you encounter issues:
1. Check EAS build logs in Expo dashboard
2. Verify all dependencies are compatible with development builds
3. Test on multiple devices
4. Check Expo documentation for latest updates

The development build will give you full access to all native features including push notifications and Socket.IO for real-time chat.
