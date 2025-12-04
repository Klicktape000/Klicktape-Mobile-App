// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { logger } from './logger'

// @ts-ignore
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushNotificationRequest {
  to: string
  title: string
  body: string
  data?: any
  sound?: string | boolean
  priority?: 'default' | 'normal' | 'high'
  channelId?: string
  badge?: number
  ttl?: number
}

interface ExpoMessage {
  to: string
  title: string
  body: string
  data?: any
  sound?: string | boolean
  priority?: 'default' | 'normal' | 'high'
  channelId?: string
  badge?: number
  ttl?: number
}

interface ExpoResponse {
  data: {
    status: 'ok' | 'error'
    id?: string
    message?: string
    details?: any
  }[]
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if Expo access token is configured
    if (!EXPO_ACCESS_TOKEN) {
      logger.error('EXPO_ACCESS_TOKEN not configured')
      return new Response(
        JSON.stringify({ error: 'Push notification service not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse the request body
    const notificationRequest: PushNotificationRequest = await req.json()

    // Validate required fields
    if (!notificationRequest.to || !notificationRequest.title || !notificationRequest.body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, title, body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate Expo push token format
    if (!notificationRequest.to.startsWith('ExponentPushToken[') &&
        !notificationRequest.to.startsWith('ExpoPushToken[')) {
      return new Response(
        JSON.stringify({ error: 'Invalid Expo push token format' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Prepare the Expo message with enhanced features
    const expoMessage: ExpoMessage = {
      to: notificationRequest.to,
      title: notificationRequest.title,
      body: notificationRequest.body,
      data: notificationRequest.data || {},
      sound: notificationRequest.sound !== false ? (notificationRequest.sound || 'default') : undefined,
      priority: notificationRequest.priority || 'default',
      ttl: notificationRequest.ttl || 2419200, // 4 weeks default
    }

    // Add platform-specific properties
    if (notificationRequest.channelId) {
      expoMessage.channelId = notificationRequest.channelId
    }

    if (notificationRequest.badge !== undefined) {
      expoMessage.badge = notificationRequest.badge
    }

    logger.push.sending(
      notificationRequest.to,
      notificationRequest.title,
      notificationRequest.body,
      notificationRequest.channelId,
      notificationRequest.priority
    )

    // Send the notification to Expo's push notification service
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EXPO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(expoMessage),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.push.apiError(response.status, errorText)

      return new Response(
        JSON.stringify({
          error: 'Failed to send push notification',
          details: errorText,
          status: response.status
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const expoResponse: ExpoResponse = await response.json()

    // Check if the notification was sent successfully
    const result = expoResponse.data?.[0]
    if (!result) {
      logger.push.unexpectedResponse(expoResponse)
      
      return new Response(
        JSON.stringify({
          error: 'Push notification failed',
          message: 'Unexpected response from Expo API',
          details: JSON.stringify(expoResponse)
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (result.status === 'error') {
      logger.push.error(result.message || 'Unknown error', result.details)

      return new Response(
        JSON.stringify({
          error: 'Push notification failed',
          message: result.message,
          details: result.details
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    logger.push.success(result.id)

    return new Response(
      JSON.stringify({
        success: true,
        id: result.id,
        message: 'Push notification sent successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    logger.error('Error in send-push-notification function:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error?.message || 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/* To deploy this function:
1. Make sure you have the Supabase CLI installed
2. Set the EXPO_ACCESS_TOKEN environment variable in your Supabase project
3. Deploy with: supabase functions deploy send-push-notification

To set the environment variable:
supabase secrets set EXPO_ACCESS_TOKEN=your_expo_access_token_here

To get an Expo access token:
1. Go to https://expo.dev/accounts/[account]/settings/access-tokens
2. Create a new access token with push notification permissions
3. Copy the token and set it as an environment variable
*/
