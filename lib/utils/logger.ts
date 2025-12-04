/**
 * Production-safe logger utility
 * Only logs in development mode to prevent performance impact in production
 */

const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  error: (...args: any[]) => {
    // Always log errors, even in production
    console.error(...args);
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
  
  // Performance-specific logging
  performance: {
    log: (...args: any[]) => {
      if (isDevelopment) {
        console.log('🚀', ...args);
      }
    },
    
    warn: (...args: any[]) => {
      if (isDevelopment) {
        console.warn('⚠️', ...args);
      }
    },
    
    memory: (...args: any[]) => {
      if (isDevelopment) {
        console.log('🧠', ...args);
      }
    },
    
    network: (...args: any[]) => {
      if (isDevelopment) {
        console.log('📶', ...args);
      }
    },
    
    api: (...args: any[]) => {
      if (isDevelopment) {
        console.log('📡', ...args);
      }
    },
    
    bundle: (...args: any[]) => {
      if (isDevelopment) {
        console.log('📦', ...args);
      }
    },
    
    general: (...args: any[]) => {
      if (isDevelopment) {
        console.log('📊', ...args);
      }
    }
  }
};

export default logger;