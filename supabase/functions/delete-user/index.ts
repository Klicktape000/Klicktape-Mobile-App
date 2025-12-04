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
    logger.function.start("Delete user")

    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      logger.function.error("Missing environment variables", {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
        hasServiceKey: !!supabaseServiceRoleKey
      })
      return createResponse({
        error: 'Server configuration error: Missing environment variables',
        details: {
          hasUrl: !!supabaseUrl,
          hasAnonKey: !!supabaseAnonKey,
          hasServiceKey: !!supabaseServiceRoleKey
        }
      }, 500)
    }

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      logger.function.error("No authorization header provided", null)
      return createResponse({ error: 'No authorization header provided' }, 401)
    }

    // Create a Supabase client with the auth header
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get the user from the auth header
    logger.function.step("Getting user from auth header")
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError) {
      logger.function.error("Error getting user", userError)
      return createResponse({
        error: 'Error getting user',
        details: userError.message
      }, 401)
    }

    if (!user) {
      logger.function.error("User not found", null)
      return createResponse({ error: 'User not found' }, 404)
    }

    const userId = user.id
    logger.function.step(`User found: ${userId}`)

    // Create an admin client to delete the user
    logger.function.step("Creating admin client")
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      { global: { headers: { Authorization: `Bearer ${supabaseServiceRoleKey}` } } }
    )

    // Delete the user's data from various tables
    // This should be done in a transaction or with careful error handling
    try {
      logger.function.step("Deleting user data from tables")

      // 1. Delete user's posts
      logger.db.operation("Deleting", "posts")
      const { error: postsError } = await supabaseAdmin
        .from('posts')
        .delete()
        .eq('user_id', userId)

      if (postsError) {
        logger.db.error("deleting", "posts", postsError)
      }

      // 2. Delete user's comments
      logger.db.operation("Deleting", "comments")
      const { error: commentsError } = await supabaseAdmin
        .from('comments')
        .delete()
        .eq('user_id', userId)

      if (commentsError) {
        logger.db.error("deleting", "comments", commentsError)
      }

      // 3. Delete user's likes
      logger.db.operation("Deleting", "likes")
      const { error: likesError } = await supabaseAdmin
        .from('likes')
        .delete()
        .eq('user_id', userId)

      if (likesError) {
        logger.db.error("deleting", "likes", likesError)
      }

      // 4. Delete user's follows
      logger.db.operation("Deleting", "follows")
      const { error: followsError } = await supabaseAdmin
        .from('follows')
        .delete()
        .or(`follower_id.eq.${userId},following_id.eq.${userId}`)

      if (followsError) {
        logger.db.error("deleting", "follows", followsError)
      }

      // 5. Delete user's messages
      logger.db.operation("Deleting", "messages")
      const { error: messagesError } = await supabaseAdmin
        .from('messages')
        .delete()
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)

      if (messagesError) {
        logger.db.error("deleting", "messages", messagesError)
      }

      // 6. Delete user's notifications
      logger.db.operation("Deleting", "notifications")
      const { error: notificationsError } = await supabaseAdmin
        .from('notifications')
        .delete()
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)

      if (notificationsError) {
        logger.db.error("deleting", "notifications", notificationsError)
      }

      // 7. Delete user's profile
      logger.db.operation("Deleting", "profile")
      const { error: profilesError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId)

      if (profilesError) {
        logger.db.error("deleting", "profile", profilesError)
      }

      // Try to delete from room_participants if it exists
      try {
        logger.db.operation("Deleting", "room_participants")
        await supabaseAdmin
          .from('room_participants')
          .delete()
          .eq('user_id', userId)
      } catch (error) {
        logger.db.error("deleting", "room_participants", error)
      }

      // Try to delete from reel_comments if it exists
      try {
        logger.db.operation("Deleting", "reel_comments")
        await supabaseAdmin
          .from('reel_comments')
          .delete()
          .eq('user_id', userId)
      } catch (error) {
        logger.db.error("deleting", "reel_comments", error)
      }

      // Try to delete from reel_likes if it exists
      try {
        logger.db.operation("Deleting", "reel_likes")
        await supabaseAdmin
          .from('reel_likes')
          .delete()
          .eq('user_id', userId)
      } catch (error) {
        logger.db.error("deleting", "reel_likes", error)
      }

      // Try to delete from bookmarks if it exists
      try {
        logger.db.operation("Deleting", "bookmarks")
        await supabaseAdmin
          .from('bookmarks')
          .delete()
          .eq('user_id', userId)
      } catch (error) {
        logger.db.error("deleting", "bookmarks", error)
      }

    } catch (tableError) {
      logger.function.error("Error deleting user data from tables", tableError)
      // Continue with user deletion even if table deletions fail
    }

    // 8. Finally, delete the user from auth.users
    logger.function.step("Deleting user from auth.users")
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteUserError) {
      logger.function.error("Error deleting user from auth.users", deleteUserError)
      return createResponse({
        error: `Failed to delete user from auth system`,
        details: deleteUserError.message,
        code: deleteUserError.code
      }, 500)
    }

    logger.function.success("User deleted successfully")
    return createResponse({
      success: true,
      message: 'User deleted successfully',
      userId: userId
    })
  } catch (error: unknown) {
    logger.function.error("Unexpected error in delete-user function", error)
    return createResponse({
      error: 'Unexpected error in delete-user function',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 500)
  }
})
