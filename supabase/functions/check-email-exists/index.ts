// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.land/manual/examples/supabase

// @ts-ignore - Deno URL imports are not recognized by TypeScript but work in Deno runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - Deno URL imports are not recognized by TypeScript but work in Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logger } from './logger'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Helper function to create consistent response objects
const createResponse = (data: any, status = 200) => {
  return new Response(
    JSON.stringify(data),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status 
    }
  )
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    logger.function.start()
    
    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      logger.env.missing(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
      return createResponse({ 
        error: 'Server configuration error: Missing environment variables',
        details: {
          hasUrl: !!supabaseUrl,
          hasServiceKey: !!supabaseServiceRoleKey
        }
      }, 500)
    }

    logger.env.check(!!supabaseUrl, !!supabaseServiceRoleKey)

    // Parse the request body
    let email: string
    try {
      logger.request.parsing()
      const body = await req.json()
      email = body.email
      
      if (!email) {
        return createResponse({ error: 'Email is required' }, 400)
      }
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const isValid = emailRegex.test(email)
      logger.request.validation(email, isValid)
      
      if (!isValid) {
        return createResponse({ error: 'Invalid email format' }, 400)
      }
    } catch (error: unknown) {
      logger.request.error(error)
      return createResponse({ error: 'Invalid request body' }, 400)
    }

    // Create an admin client to check if the email exists
    logger.function.step("Creating admin client")
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      { global: { headers: { Authorization: `Bearer ${supabaseServiceRoleKey}` } } }
    )

    // Check if the email exists in auth.users
    logger.db.operation(`Checking if email exists: ${email}`)
    const { data, error } = await supabaseAdmin.auth.admin.listUsers()
    
    if (error) {
      logger.db.error("Error listing users", error)
      return createResponse({ 
        error: 'Error checking email', 
        details: error.message 
      }, 500)
    }

    // Check if the email exists in the list of users
    const exists = data.users.some((user: any) => user.email === email)
    logger.function.success(email, exists)

    return createResponse({ 
      exists,
      message: exists ? 'Email already exists' : 'Email is available'
    })
  } catch (error: unknown) {
    logger.function.error("Unexpected error in check-email-exists function", error)
    return createResponse({ 
      error: 'Unexpected error in check-email-exists function', 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 500)
  }
})
