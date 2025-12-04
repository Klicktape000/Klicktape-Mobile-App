import { useEffect } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { referralAPI } from '@/lib/referralApi';

/**
 * Deep Link Handler Component
 * Handles incoming deep links and navigates to appropriate screens
 */
export default function DeepLinkHandler() {
  // Handle referral links
  const handleReferralLink = async (referralCode: string) => {
    try {
      //// console.log('🎯 Processing referral link with code:', referralCode);

      // Validate the referral code format
      const cleanCode = referralCode.trim().toUpperCase();
      if (!/^[A-Z0-9]{6,10}$/.test(cleanCode)) {
        // console.error('❌ Invalid referral code format:', cleanCode);
        return;
      }

      // Store referral code for later use during registration
      await AsyncStorage.setItem('pendingReferralCode', cleanCode);
      //// console.log('💾 Stored pending referral code:', cleanCode);

      // Track the referral click
      const trackSuccess = await referralAPI.trackReferralClick(cleanCode);
      if (trackSuccess) {
        //// console.log('✅ Referral click tracked successfully');
      } else {
        //// console.log('⚠️ Failed to track referral click, but continuing...');
      }

      // Navigate to signup page
      //// console.log('📱 Navigating to signup page');
      router.push('/(auth)/sign-up');

    } catch (__error) {
      // console.error('❌ Error handling referral link:', error);
      // Still navigate to signup even if there's an error
      router.push('/(auth)/sign-up');
    }
  };

  useEffect(() => {
    //// console.log('🚀 DeepLinkHandler: Component mounted and listening for deep links');
    // Handle deep links when app is already open
    const handleDeepLink = async (url: string) => {
      //// console.log('🔗 Deep link received:', url);
      //// console.log('🔗 URL type:', typeof url);
      //// console.log('🔗 URL length:', url?.length);
      
      try {
        // Parse the URL
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        const params = urlObj.searchParams;
        
        //// console.log('📍 Path:', path);
        //// console.log('📋 Params:', Object.fromEntries(params.entries()));
        
        // Handle different deep link routes
        if (path.startsWith('/post/')) {
          const postId = path.split('/post/')[1];
          if (postId) {
            //// console.log('📝 Navigating to post:', postId);
            router.push(`/post/${postId}`);
          }
        } else if (path.startsWith('/reel/')) {
          const reelId = path.split('/reel/')[1];
          if (reelId) {
            //// console.log('🎬 Navigating to reel:', reelId);
            router.push(`/reel/${reelId}`);
          }
        } else if (path.startsWith('/userProfile/')) {
          const userId = path.split('/userProfile/')[1];
          if (userId) {
            //// console.log('👤 Navigating to user profile:', userId);
            router.push(`/userProfile/${userId}`);
          }
        } else if (path.startsWith('/invite/')) {
          const referralCode = path.split('/invite/')[1];
          if (referralCode) {
            //// console.log('🎯 Referral link detected:', referralCode);
            await handleReferralLink(referralCode);
          }
        } else if (path.startsWith('/reset-password')) {
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          //// console.log('🔗 DeepLinkHandler: Reset password path detected');
          //// console.log('🔑 DeepLinkHandler: Access token:', accessToken?.substring(0, 20) + '...');
          //// console.log('🔄 DeepLinkHandler: Refresh token:', refreshToken?.substring(0, 20) + '...');
          if (accessToken) {
            //// console.log('🔑 DeepLinkHandler: Navigating to reset password with tokens');
            router.push(`/reset-password?access_token=${accessToken}&refresh_token=${refreshToken || ''}`);
          } else {
            //// console.log('❌ DeepLinkHandler: No access token found in deep link');
          }
        } else if (path.startsWith('/auth/verified')) {
          //// console.log('✅ Email verification confirmed - redirecting to sign-in');
          // Show a success message and redirect to sign-in
          router.push('/(auth)/sign-in');
        } else {
          // Default to home screen for unrecognized paths
          //// console.log('🏠 Navigating to home (default)');
          router.push('/(root)/(tabs)/home');
        }
      } catch (__error) {
        // console.error('❌ Error parsing deep link:', error);
        // Fallback to home screen
        router.push('/(root)/(tabs)/home');
      }
    };

    // Handle deep link when app is opened from a link
    const getInitialURL = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          //// console.log('🚀 App opened with deep link:', initialUrl);
          // Add a small delay to ensure the app is fully loaded
          setTimeout(() => {
            handleDeepLink(initialUrl);
          }, 1000);
        }
      } catch (__error) {
        // console.error('❌ Error getting initial URL:', error);
      }
    };

    // Set up event listener for deep links when app is already open
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    // Check for initial URL
    getInitialURL();

    // Cleanup
    return () => {
      subscription?.remove();
    };
  }, [handleReferralLink]);

  // This component doesn't render anything
  return null;
}

