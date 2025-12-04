/**
 * Safe error logging utility for notifications
 * Prevents crashes when logging errors in notification handlers
 */

export class NotificationErrorHandler {
  /**
   * Safely log an error without causing crashes
   */
  static safeLog(level: 'log' | 'warn' | 'error', message: string, error?: any) {
    try {
      const logMessage = error ? `${message}: ${error}` : message;
      
      switch (level) {
        case 'error':
          //// console.log(`❌ ${logMessage}`); // Use console.log instead of console.error to prevent crashes
          break;
        case 'warn':
          //// console.log(`⚠️ ${logMessage}`);
          break;
        default:
          //// console.log(logMessage);
      }
    } catch {
      // If even logging fails, try a basic fallback
      try {
        //// console.log('Notification error occurred but could not be logged safely');
      } catch {
        // Silent fail - don't crash the app
      }
    }
  }

  /**
   * Safe error logging specifically for notification errors
   */
  static logNotificationError(context: string, error: any) {
    NotificationErrorHandler.safeLog('error', `Notification ${context} error`, error);
  }

  /**
   * Safe warning logging for notifications
   */
  static logNotificationWarning(context: string, message: string) {
    NotificationErrorHandler.safeLog('warn', `Notification ${context}: ${message}`);
  }

  /**
   * Safe info logging for notifications
   */
  static logNotificationInfo(context: string, message: string) {
    NotificationErrorHandler.safeLog('log', `🔔 Notification ${context}: ${message}`);
  }

  /**
   * Wrap a function with safe error handling
   */
  static wrapWithErrorHandling<T extends (...args: any[]) => any>(
    fn: T,
    context: string
  ): T {
    return ((...args: any[]) => {
      try {
        const result = fn(...args);
        
        // Handle async functions
        if (result && typeof result.catch === 'function') {
          return result.catch((__error: any) => {
            NotificationErrorHandler.logNotificationError(context, __error);
            return null; // Return null instead of throwing
          });
        }

        return result;
      } catch (__error) {
        NotificationErrorHandler.logNotificationError(context, __error);
        return null; // Return null instead of throwing
      }
    }) as T;
  }

  /**
   * Safely execute an async function with error handling
   */
  static async safeExecute<T>(
    fn: () => Promise<T>,
    context: string,
    fallbackValue?: T
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (__error) {
      NotificationErrorHandler.logNotificationError(context, __error);
      return fallbackValue ?? null;
    }
  }

  /**
   * Check if an error is a network/connection error
   */
  static isNetworkError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message || error.toString() || '';
    const networkKeywords = [
      'network',
      'connection',
      'timeout',
      'fetch',
      'websocket',
      'realtime',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT'
    ];
    
    return networkKeywords.some(keyword => 
      errorMessage.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Get a user-friendly error message
   */
  static getUserFriendlyMessage(error: any, context: string): string {
    if (NotificationErrorHandler.isNetworkError(error)) {
      return 'Connection issue - notifications may be delayed';
    }
    
    switch (context) {
      case 'subscription':
        return 'Notification updates may be delayed';
      case 'permission':
        return 'Unable to request notification permissions';
      case 'send':
        return 'Failed to send notification';
      default:
        return 'Notification system temporarily unavailable';
    }
  }
}

// Export convenience functions
export const safeLogError = NotificationErrorHandler.logNotificationError;
export const safeLogWarning = NotificationErrorHandler.logNotificationWarning;
export const safeLogInfo = NotificationErrorHandler.logNotificationInfo;
export const wrapSafe = NotificationErrorHandler.wrapWithErrorHandling;
export const safeExecute = NotificationErrorHandler.safeExecute;

