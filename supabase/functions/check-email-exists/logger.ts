// Production-safe logger utility for check-email-exists Supabase Edge Function
// Only logs errors and warnings in production, full logging in development

const isDevelopment = Deno.env.get('ENVIRONMENT') === 'development' || 
                     Deno.env.get('NODE_ENV') === 'development' ||
                     !Deno.env.get('SUPABASE_URL')?.includes('supabase.co')

export const logger = {
  // General logging (development only)
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[CHECK-EMAIL]', ...args)
    }
  },

  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info('[CHECK-EMAIL]', ...args)
    }
  },

  // Always log warnings and errors
  warn: (...args: any[]) => {
    console.warn('[CHECK-EMAIL]', ...args)
  },

  error: (...args: any[]) => {
    console.error('[CHECK-EMAIL]', ...args)
  },

  // Function-specific logging
  function: {
    start: () => {
      if (isDevelopment) {
        console.log('[CHECK-EMAIL] Function invoked')
      }
    },

    step: (message: string, data?: any) => {
      if (isDevelopment) {
        console.log(`[CHECK-EMAIL] ${message}`, data || '')
      }
    },

    success: (email: string, exists: boolean) => {
      if (isDevelopment) {
        console.log(`[CHECK-EMAIL] Email check completed: ${email} - exists: ${exists}`)
      }
    },

    error: (message: string, error?: any) => {
      console.error(`[CHECK-EMAIL] ${message}`, error || '')
    }
  },

  // Environment and configuration logging
  env: {
    missing: (variables: string[]) => {
      console.error(`[CHECK-EMAIL] Missing environment variables: ${variables.join(', ')}`)
    },

    check: (hasUrl: boolean, hasServiceKey: boolean) => {
      if (isDevelopment) {
        console.log(`[CHECK-EMAIL] Environment check - URL: ${hasUrl}, Service Key: ${hasServiceKey}`)
      }
    }
  },

  // Request parsing logging
  request: {
    parsing: () => {
      if (isDevelopment) {
        console.log('[CHECK-EMAIL] Parsing request body')
      }
    },

    error: (error: any) => {
      console.error('[CHECK-EMAIL] Error parsing request body:', error)
    },

    validation: (email: string, isValid: boolean) => {
      if (isDevelopment) {
        console.log(`[CHECK-EMAIL] Email validation - ${email}: ${isValid}`)
      }
    }
  },

  // Database operations logging
  db: {
    operation: (operation: string) => {
      if (isDevelopment) {
        console.log(`[CHECK-EMAIL] Database operation: ${operation}`)
      }
    },

    success: (message: string, data?: any) => {
      if (isDevelopment) {
        console.log(`[CHECK-EMAIL] DB Success: ${message}`, data || '')
      }
    },

    error: (message: string, error: any) => {
      console.error(`[CHECK-EMAIL] DB Error: ${message}`, error)
    }
  }
}