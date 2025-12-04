/**
 * Test utility for forgot password functionality
 * This can be used for debugging email sending issues
 */

import { supabase } from './supabase';

export interface ForgotPasswordTestResult {
  success: boolean;
  message: string;
  details?: any;
  error?: any;
}

/**
 * Test the forgot password functionality with detailed logging
 */
export async function testForgotPassword(email: string): Promise<ForgotPasswordTestResult> {
// console.log('🧪 Testing forgot password functionality...');
// console.log('📧 Email:', email);
  
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        message: 'Invalid email format',
      };
    }
    
    // Check Supabase client
    if (!supabase) {
      return {
        success: false,
        message: 'Supabase client not initialized',
      };
    }
    
    const redirectUrl = 'https://klicktape-d087a.web.app/reset-password.html';
// console.log('🔗 Redirect URL:', redirectUrl);
    
    // Clear any existing session first
    await supabase.auth.signOut();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

// console.log('📤 Sending password reset email...');
    
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    
    if (error) {
      console.error('❌ Error:', error);
      return {
        success: false,
        message: `Failed to send password reset email: ${error.message}`,
        error: error,
        details: {
          status: error.status,
        }
      };
    }

// console.log('✅ Password reset email sent successfully!');
// console.log('📊 Response data:', data);
    
    return {
      success: true,
      message: 'Password reset email sent successfully',
      details: data,
    };
    
  } catch (__error: any) {
    console.error('❌ Unexpected error:', __error);
    return {
      success: false,
      message: `Unexpected error: ${__error.message}`,
      error: __error,
    };
  }
}

/**
 * Test multiple email scenarios
 */
export async function testMultipleEmails(): Promise<ForgotPasswordTestResult[]> {
  const testEmails = [
    'test@example.com',
    'nonexistent@test.com',
    'invalid-email',
    '', // Empty email
  ];
  
  const results: ForgotPasswordTestResult[] = [];
  
  for (const email of testEmails) {
// console.log(`\n${'='.repeat(50)}`);
// console.log(`Testing email: ${email || '(empty)'}`);
    
    const result = await testForgotPassword(email);
    results.push({
      ...result,
      details: {
        ...result.details,
        testedEmail: email,
      }
    });
    
    // Wait between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return results;
}

/**
 * Check if the redirect URL is accessible
 */
export async function testRedirectUrl(): Promise<ForgotPasswordTestResult> {
  const redirectUrl = 'https://klicktape-d087a.web.app/reset-password.html';
  
  try {
// console.log('🌐 Testing redirect URL accessibility...');
    
    const response = await fetch(redirectUrl, {
      method: 'HEAD', // Just check if the URL is accessible
    });
    
    if (response.ok) {
      return {
        success: true,
        message: 'Redirect URL is accessible',
        details: {
          status: response.status,
          url: redirectUrl,
        }
      };
    } else {
      return {
        success: false,
        message: `Redirect URL returned status ${response.status}`,
        details: {
          status: response.status,
          url: redirectUrl,
        }
      };
    }
    
  } catch (__error: any) {
    return {
      success: false,
      message: `Failed to access redirect URL: ${__error.message}`,
      error: __error,
    };
  }
}

