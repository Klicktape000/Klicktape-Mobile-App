/**
 * Production-safe logger for Socket.IO server
 * Only logs in development mode to prevent performance impact in production
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = {
  // General logging
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  // Warning messages (always logged but with reduced verbosity in production)
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    } else {
      // In production, only log critical warnings
      const message = args.join(' ');
      if (message.includes('Failed') || message.includes('Error') || message.includes('❌')) {
        console.warn(...args);
      }
    }
  },

  // Error messages (always logged)
  error: (...args) => {
    console.error(...args);
  },

  // Info messages (development only)
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  // Socket-specific logging
  socket: {
    connection: (...args) => {
      if (isDevelopment) {
        console.log(...args);
      }
    },
    
    message: (...args) => {
      if (isDevelopment) {
        console.log(...args);
      }
    },
    
    status: (...args) => {
      if (isDevelopment) {
        console.log(...args);
      }
    },
    
    reaction: (...args) => {
      if (isDevelopment) {
        console.log(...args);
      }
    },
    
    typing: (...args) => {
      if (isDevelopment) {
        console.log(...args);
      }
    },
    
    broadcast: (...args) => {
      if (isDevelopment) {
        console.log(...args);
      }
    }
  },

  // Database operation logging
  db: {
    success: (...args) => {
      if (isDevelopment) {
        console.log(...args);
      }
    },
    
    error: (...args) => {
      console.error(...args); // Always log DB errors
    },
    
    warn: (...args) => {
      if (isDevelopment) {
        console.warn(...args);
      }
    }
  },

  // Server startup and lifecycle
  server: {
    startup: (...args) => {
      console.log(...args); // Always log server startup info
    },
    
    shutdown: (...args) => {
      console.log(...args); // Always log shutdown info
    },
    
    health: (...args) => {
      if (isDevelopment) {
        console.log(...args);
      }
    }
  }
};

module.exports = logger;