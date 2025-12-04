// Production-safe logger for Supabase Edge Functions
// Only logs errors and critical warnings in production

const isDevelopment = Deno.env.get('DENO_ENV') === 'development' || 
                     Deno.env.get('NODE_ENV') === 'development' ||
                     !Deno.env.get('SUPABASE_URL')?.includes('supabase.co');

export const logger = {
  // General logging (dev only)
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  // Information logging (dev only)
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  // Warning logging (always logged for critical issues)
  warn: (...args: any[]) => {
    console.warn(...args);
  },

  // Error logging (always logged)
  error: (...args: any[]) => {
    console.error(...args);
  },

  // Function-specific loggers
  function: {
    start: (functionName: string) => {
      if (isDevelopment) {
        console.log(`${functionName} function called`);
      }
    },
    
    step: (step: string) => {
      if (isDevelopment) {
        console.log(step);
      }
    },
    
    success: (message: string, data?: any) => {
      if (isDevelopment) {
        console.log(message, data || '');
      }
    },
    
    error: (message: string, error: any) => {
      console.error(message, error);
    },
    
    warn: (message: string, error?: any) => {
      console.warn(message, error || '');
    }
  },

  // Database operation loggers
  db: {
    operation: (operation: string, table: string) => {
      if (isDevelopment) {
        console.log(`${operation} ${table}`);
      }
    },
    
    success: (operation: string, table: string) => {
      if (isDevelopment) {
        console.log(`Successfully ${operation} ${table}`);
      }
    },
    
    error: (operation: string, table: string, error: any) => {
      console.warn(`Error ${operation} ${table}`, error);
    }
  }
};