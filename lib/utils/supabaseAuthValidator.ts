/**
 * Supabase Authentication Validator
 * Verifies Supabase configuration and provides proper error handling for auth failures
 */

import { supabase } from '../supabase';

interface AuthValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config: {
    hasUrl: boolean;
    hasAnonKey: boolean;
    hasServiceKey: boolean;
    isConnected: boolean;
  };
}

class SupabaseAuthValidator {
  private static instance: SupabaseAuthValidator;
  private validationCache: AuthValidationResult | null = null;
  private lastValidation: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): SupabaseAuthValidator {
    if (!SupabaseAuthValidator.instance) {
      SupabaseAuthValidator.instance = new SupabaseAuthValidator();
    }
    return SupabaseAuthValidator.instance;
  }

  /**
   * Validate Supabase authentication configuration
   */
  async validateAuth(): Promise<AuthValidationResult> {
    // Return cached result if still valid
    if (this.validationCache && this.isCacheValid()) {
      return this.validationCache;
    }

    const result: AuthValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      config: {
        hasUrl: false,
        hasAnonKey: false,
        hasServiceKey: false,
        isConnected: false,
      }
    };

    try {
      // Check environment variables
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      result.config.hasUrl = !!supabaseUrl;
      result.config.hasAnonKey = !!supabaseAnonKey;
      result.config.hasServiceKey = !!supabaseServiceKey;

      if (!supabaseUrl) {
        result.errors.push('EXPO_PUBLIC_SUPABASE_URL is not configured');
        result.isValid = false;
      }

      if (!supabaseAnonKey) {
        result.errors.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is not configured');
        result.isValid = false;
      }

      if (!supabaseServiceKey) {
        result.warnings.push('SUPABASE_SERVICE_ROLE_KEY is not configured (optional for client-side)');
      }

      // Test connection if client is available
      if (supabase && result.config.hasUrl && result.config.hasAnonKey) {
        try {
          // Test basic connection with a simple query
          const { error: connectionError } = await supabase
            .from('profiles')
            .select('count')
            .limit(1);

          if (connectionError) {
            if (connectionError.message.includes('relation "profiles" does not exist')) {
              result.warnings.push('Profiles table does not exist - database may not be set up');
            } else if (connectionError.message.includes('JWT')) {
              result.errors.push('Invalid JWT token - check your Supabase keys');
              result.isValid = false;
            } else if (connectionError.message.includes('Invalid API key')) {
              result.errors.push('Invalid API key - check EXPO_PUBLIC_SUPABASE_ANON_KEY');
              result.isValid = false;
            } else {
              result.warnings.push(`Connection test failed: ${connectionError.message}`);
            }
          } else {
            result.config.isConnected = true;
          }
        } catch (testError: any) {
          result.warnings.push(`Connection test error: ${testError.message}`);
        }
      }

      // Test authentication methods
      if (supabase && result.config.isConnected) {
        try {
          // Test session retrieval
          const { error: sessionError } = await supabase.auth.getSession();
          if (sessionError && !sessionError.message.includes('Auth session missing')) {
            result.warnings.push(`Session retrieval issue: ${sessionError.message}`);
          }
        } catch (sessionTestError: any) {
          result.warnings.push(`Session test error: ${sessionTestError.message}`);
        }
      }

    } catch (validationError: any) {
      result.errors.push(`Validation error: ${validationError.message}`);
      result.isValid = false;
    }

    // Cache the result
    this.validationCache = result;
    this.lastValidation = Date.now();

    return result;
  }

  /**
   * Get a quick validation status without full testing
   */
  getQuickValidation(): Partial<AuthValidationResult> {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    return {
      isValid: !!(supabaseUrl && supabaseAnonKey && supabase),
      config: {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        isConnected: false, // Would need full validation
      }
    };
  }

  /**
   * Handle authentication errors with proper context
   */
  handleAuthError(error: any, context: string = 'Authentication'): void {
    if (!error) return;

    const errorMessage = error.message || error.toString();
    
    if (errorMessage.includes('Auth session missing')) {
// console.log(`🔐 ${context}: No authenticated session (expected when logged out)`);
    } else if (errorMessage.includes('Invalid JWT')) {
      console.error(`🔐 ${context}: Invalid JWT token - check Supabase configuration`);
    } else if (errorMessage.includes('Invalid API key')) {
      console.error(`🔐 ${context}: Invalid API key - check EXPO_PUBLIC_SUPABASE_ANON_KEY`);
    } else if (errorMessage.includes('Network request failed')) {
// console.warn(`🔐 ${context}: Network error - check internet connection and Supabase URL`);
    } else if (errorMessage.includes('fetch')) {
// console.warn(`🔐 ${context}: Network fetch error - possible connectivity issue`);
    } else {
      console.error(`🔐 ${context}: ${errorMessage}`);
    }
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.validationCache = null;
    this.lastValidation = 0;
  }

  private isCacheValid(): boolean {
    return Date.now() - this.lastValidation < this.CACHE_DURATION;
  }
}

// Export singleton instance
export const supabaseAuthValidator = SupabaseAuthValidator.getInstance();

// Convenience function for error handling
export const handleSupabaseAuthError = (error: any, context?: string) => {
  supabaseAuthValidator.handleAuthError(error, context);
};

// Auto-validate in development
if (__DEV__ || process.env.NODE_ENV === 'development') {
  supabaseAuthValidator.validateAuth().then((result) => {
    if (!result.isValid) {
      console.error('🔐 Supabase Auth Validation Failed:', result.errors);
    }
    if (result.warnings.length > 0) {
// console.warn('🔐 Supabase Auth Warnings:', result.warnings);
    }
    if (result.isValid && result.config.isConnected) {
// console.log('🔐 Supabase Auth: Configuration validated successfully');
    }
  }).catch((error) => {
    console.error('🔐 Supabase Auth Validation Error:', error);
  });
}