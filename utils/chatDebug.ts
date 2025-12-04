import { supabase } from '../lib/supabase';

/**
 * Debug utility to check chat-related issues
 */
export const chatDebug = {
  /**
   * Check if a user exists in the profiles table
   */
  checkUserExists: async (userId: string) => {
    // if (__DEV__) {
    //   alertService.debug('🔍 Chat Debug', `Checking if user exists: ${userId}`);
    // }
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, created_at')
      .eq('id', userId)
      .single();
    
    // if (__DEV__) {
    //   alertService.debug('🔍 User check result', JSON.stringify({ data, error }, null, 2));
    // }
    
    return {
      exists: !!data && !error,
      user: data || null,
      error
    };
  },

  listAllUsers: async () => {
    // if (__DEV__) {
    //   alertService.debug('🔍 Chat Debug', 'Listing all users in profiles table...');
    // }
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, email, created_at')
      .limit(10);
    
    // if (__DEV__) {
    //   alertService.debug('🔍 All users', JSON.stringify({ count: data?.length, data, error }, null, 2));
    // }
    
    return { data, error };
  },

  getCurrentUser: async () => {
    // if (__DEV__) {
    //   alertService.debug('🔍 Chat Debug', 'Checking current authenticated user...');
    // }
    
    const { data: { user }, error } = await supabase.auth.getUser();
    // if (__DEV__) {
    //   alertService.debug('🔍 Current auth user', JSON.stringify({ user: user?.id, email: user?.email, error }, null, 2));
    // }
    
    if (user) {
      await chatDebug.checkUserExists(user.id);
      // if (__DEV__) {
      //   alertService.debug('🔍 Current user profile exists', `Profile exists: ${profileCheck.exists}`);
      // }
    }
    
    return { user, error };
  },

  /**
   * Run full diagnostic for chat issues
   */
  runFullDiagnostic: async (recipientId: string) => {
    // if (__DEV__) {
    //   alertService.debug('🔍 Chat Debug', 'Running full chat diagnostic...');
    //   alertService.debug('🔍 Chat Debug', `Recipient ID: ${recipientId}`);
    // }
      
    // Check current user
    const currentUserCheck = await chatDebug.getCurrentUser();
    
    // Check recipient
    const recipientCheck = await chatDebug.checkUserExists(recipientId);
    
    // List some users for context
    const usersList = await chatDebug.listAllUsers();
    
    const diagnostic = {
      recipientId,
      currentUser: currentUserCheck,
      recipient: recipientCheck,
      sampleUsers: usersList
    };
    
    // if (__DEV__) {
    //   alertService.debug('🔍 Full diagnostic result', JSON.stringify(diagnostic, null, 2));
    // }
    return diagnostic;
  }
};

export const runChatDiagnostic = async (recipientId: string) => {
  // This function is deprecated, use chatDebug.runFullDiagnostic instead
  return await chatDebug.runFullDiagnostic(recipientId);
};

// Export for easy access in console
if (typeof window !== 'undefined') {
  (window as any).chatDebug = chatDebug;
}
