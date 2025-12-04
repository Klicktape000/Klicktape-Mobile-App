/**
 * Development Error Filter
 * Filters out development-specific errors while preserving important ones
 */

interface ErrorFilterConfig {
  enableFiltering: boolean;
  logFilteredErrors: boolean;
  preservePatterns: string[];
  filterPatterns: string[];
}

class DevelopmentErrorFilter {
  private static instance: DevelopmentErrorFilter;
  private config: ErrorFilterConfig;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;

  constructor() {
    this.config = {
      enableFiltering: __DEV__ || process.env.NODE_ENV === 'development',
      logFilteredErrors: false,
      preservePatterns: [
        'Authentication',
        'Network request failed',
        'Database',
        'API',
        'Unauthorized',
        'Forbidden',
        'Not found',
        'Validation',
        'Critical',
        'Fatal'
      ],
      filterPatterns: [
        'net::ERR_INSUFFICIENT_RESOURCES',
        'net::ERR_ABORTED',
        'expo-router/entry.bundle',
        'Hot reload',
        'Fast refresh',
        'Metro bundler',
        'Development server',
        'WebSocket connection',
        'HMR',
        'Source map',
        'DevTools'
      ]
    };

    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
  }

  static getInstance(): DevelopmentErrorFilter {
    if (!DevelopmentErrorFilter.instance) {
      DevelopmentErrorFilter.instance = new DevelopmentErrorFilter();
    }
    return DevelopmentErrorFilter.instance;
  }

  /**
   * Initialize error filtering
   */
  initialize(): void {
    if (!this.config.enableFiltering) {
      return;
    }

    // Override console.error
    console.error = (...args: any[]) => {
      if (this.shouldFilterError(args)) {
        if (this.config.logFilteredErrors) {
          this.originalConsoleError('[FILTERED]', ...args);
        }
        return;
      }
      this.originalConsoleError(...args);
    };

    // Override console.warn
    console.warn = (...args: any[]) => {
      if (this.shouldFilterError(args)) {
        if (this.config.logFilteredErrors) {
          this.originalConsoleWarn('[FILTERED]', ...args);
        }
        return;
      }
      this.originalConsoleWarn(...args);
    };

    // Handle unhandled promise rejections - only in browser environment
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      try {
        window.addEventListener('unhandledrejection', (event) => {
          const errorMessage = event.reason?.message || event.reason?.toString() || '';
          if (this.shouldFilterErrorMessage(errorMessage)) {
            event.preventDefault();
            if (this.config.logFilteredErrors) {
              this.originalConsoleError('[FILTERED PROMISE REJECTION]', event.reason);
            }
          }
        });
      } catch (error) {
        // Silently fail if addEventListener is not available
        console.warn('Could not set up unhandled rejection handler:', error);
      }
    }
  }

  /**
   * Check if error should be filtered
   */
  private shouldFilterError(args: any[]): boolean {
    const errorMessage = args.join(' ').toLowerCase();
    return this.shouldFilterErrorMessage(errorMessage);
  }

  /**
   * Check if error message should be filtered
   */
  private shouldFilterErrorMessage(message: string): boolean {
    const lowerMessage = message.toLowerCase();

    // Always preserve important errors
    for (const pattern of this.config.preservePatterns) {
      if (lowerMessage.includes(pattern.toLowerCase())) {
        return false;
      }
    }

    // Filter development-specific errors
    for (const pattern of this.config.filterPatterns) {
      if (lowerMessage.includes(pattern.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Restore original console methods
   */
  restore(): void {
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ErrorFilterConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ErrorFilterConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const developmentErrorFilter = DevelopmentErrorFilter.getInstance();

// DO NOT auto-initialize - let the app initialize it manually after polyfills are loaded