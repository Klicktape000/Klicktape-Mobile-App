import { alertService } from './alertService';

export interface NetworkErrorOptions {
  context?: string;
  showUserAlert?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  fallbackValue?: any;
}

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export class NetworkErrorHandler {
  /**
   * Enhanced network error detection for React Native
   */
  static isNetworkError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message || error.toString() || '';
    const errorCode = error.code || '';
    
    // Common network error patterns
    const networkPatterns = [
      'Network request failed',
      'network error',
      'connection error',
      'timeout',
      'fetch failed',
      'websocket',
      'realtime',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'EHOSTUNREACH',
      'ENETUNREACH',
      'ERR_NETWORK',
      'ERR_INTERNET_DISCONNECTED',
      'No internet connection',
      'Unable to resolve host',
      'Connection timed out',
      'Download failed - no valid response',
      'Redis operation timed out',
      'Circuit breaker is open'
    ];
    
    // Check error message
    const hasNetworkMessage = networkPatterns.some(pattern => 
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
    
    // Check error codes
    const networkCodes = ['NETWORK_ERROR', 'TIMEOUT', 'CONNECTION_ERROR', 'REDIS_TIMEOUT'];
    const hasNetworkCode = networkCodes.some(code => 
      errorCode.toLowerCase().includes(code.toLowerCase())
    );
    
    // Check if it's a TypeError with network-related message (common in React Native)
    const isNetworkTypeError = error instanceof TypeError && hasNetworkMessage;
    
    return hasNetworkMessage || hasNetworkCode || isNetworkTypeError;
  }

  /**
   * Get user-friendly error message based on error type
   */
  static getUserFriendlyMessage(error: any, context: string = 'operation'): string {
    if (this.isNetworkError(error)) {
      const errorMessage = error.message || error.toString() || '';
      
      // Specific network error messages
      if (errorMessage.includes('Redis operation timed out')) {
        return 'Cache service temporarily unavailable. Please try again.';
      }
      
      if (errorMessage.includes('Circuit breaker is open')) {
        return 'Service temporarily unavailable due to high error rate. Please try again in a moment.';
      }
      
      if (errorMessage.includes('Download failed - no valid response')) {
        return 'Image download failed. Please check your connection and try again.';
      }
      
      return `Network connection issue. Please check your internet connection and try again.`;
    }
    
    // Handle specific error types
    const errorMessage = error.message || error.toString() || '';
    
    if (errorMessage.includes('timeout')) {
      return `${context} timed out. Please try again.`;
    }
    
    if (errorMessage.includes('not authenticated') || errorMessage.includes('unauthorized')) {
      return 'Please sign in to continue.';
    }
    
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return `Requested ${context} not found.`;
    }
    
    if (errorMessage.includes('server error') || errorMessage.includes('500')) {
      return 'Server error. Please try again later.';
    }
    
    return `${context} failed. Please try again.`;
  }

  /**
   * Handle network errors with user feedback
   */
  static handleNetworkError(
    error: any, 
    options: NetworkErrorOptions = {}
  ): void {
    const {
      context = 'Network operation',
      showUserAlert = true
    } = options;
    
    if (NetworkErrorHandler.isNetworkError(error)) {
      if (showUserAlert) {
        alertService.networkError(context);
      }
    } else {
      const message = NetworkErrorHandler.getUserFriendlyMessage(error, context);
      if (showUserAlert) {
        alertService.error('Error', message);
      }
    }
  }

  /**
   * Retry function with exponential backoff
   */
  static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2
    }
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (__error) {
        lastError = __error;
        
        // Check if error is retryable
        if (!this.isRetryableError(__error)) {
          // Warning: Non-retryable error encountered
          throw __error;
        }
        
        // Don't retry on last attempt
        if (attempt === options.maxRetries) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          options.baseDelay * Math.pow(options.backoffFactor, attempt),
          options.maxDelay
        );
        
        // Add jitter to prevent thundering herd
        const jitteredDelay = delay + Math.random() * 1000;

// console.log(`⏳ Retrying operation in ${Math.round(jitteredDelay)}ms (attempt ${attempt + 1}/${options.maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, jitteredDelay));
      }
    }
    
    throw lastError;
  }

  /**
   * Determine if an error is retryable
   */
  static isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message || error.toString() || '';
    const statusCode = error.status || error.statusCode;
    
    // Don't retry client errors (4xx)
    if (statusCode >= 400 && statusCode < 500) {
      return false;
    }
    
    // Don't retry authentication errors
    if (errorMessage.includes('unauthorized') || errorMessage.includes('not authenticated')) {
      return false;
    }
    
    // Don't retry not found errors
    if (errorMessage.includes('not found') || statusCode === 404) {
      return false;
    }
    
    // Don't retry forbidden errors
    if (errorMessage.includes('forbidden') || statusCode === 403) {
      return false;
    }
    
    // Retry network errors, timeouts, and server errors
    return this.isNetworkError(error) || statusCode >= 500;
  }

  /**
   * Execute function with network error handling and optional retry
   */
  static async executeWithErrorHandling<T>(
    fn: () => Promise<T>,
    options: NetworkErrorOptions & { retryOptions?: RetryOptions } = {}
  ): Promise<T | null> {
    const {
      context = 'Operation',
      showUserAlert = true,
      maxRetries = 0,
      fallbackValue = null,
      retryOptions
    } = options;
    
    try {
      if (maxRetries > 0 || retryOptions) {
        const retryConfig = retryOptions || {
          maxRetries,
          baseDelay: 1000,
          maxDelay: 5000,
          backoffFactor: 2
        };
        
        return await this.retryWithBackoff(fn, retryConfig);
      } else {
        return await fn();
      }
    } catch (__error) {
      NetworkErrorHandler.handleNetworkError(__error, { context, showUserAlert });
      return fallbackValue;
    }
  }

  /**
   * Check if device has internet connectivity (basic check)
   */
  static async checkConnectivity(): Promise<boolean> {
    try {
      // Simple connectivity check - try to fetch a small resource
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Wrapper for API calls with automatic network error handling
   */
  static async apiCall<T>(
    apiFunction: () => Promise<T>,
    context: string,
    options: {
      showUserAlert?: boolean;
      maxRetries?: number;
      fallbackValue?: T;
    } = {}
  ): Promise<T | null> {
    return this.executeWithErrorHandling(apiFunction, {
      context,
      ...options
    });
  }
}

// Convenience exports
export const isNetworkError = NetworkErrorHandler.isNetworkError;
export const handleNetworkError = NetworkErrorHandler.handleNetworkError;
export const retryWithBackoff = NetworkErrorHandler.retryWithBackoff;
export const executeWithErrorHandling = NetworkErrorHandler.executeWithErrorHandling;
export const apiCall = NetworkErrorHandler.apiCall;
