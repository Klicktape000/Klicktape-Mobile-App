// Production-safe logger for send-push-notification Edge Function
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

  // Push notification specific loggers
  push: {
    sending: (to: string, title: string, body: string, channelId?: string, priority?: string) => {
      if (isDevelopment) {
        console.log('Sending push notification:', {
          to: to.substring(0, 20) + '...',
          title,
          body: body.substring(0, 50) + '...',
          channelId,
          priority,
        });
      }
    },
    
    success: (id?: string) => {
      if (isDevelopment) {
        console.log('Push notification sent successfully:', id);
      }
    },
    
    error: (message: string, details?: any) => {
      console.error('Push notification error:', message, details);
    },
    
    apiError: (status: number, errorText: string) => {
      console.error('Expo API error:', status, errorText);
    },
    
    unexpectedResponse: (response: any) => {
      console.error('Expo API returned unexpected response structure:', response);
    }
  }
};