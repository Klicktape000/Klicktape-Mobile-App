import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';
import { authManager } from './authManager';

// Import CachedUser type from authManager
interface CachedUser {
  id: string;
  email: string;
  username?: string;
  avatar_url?: string;
  cached_at: number;
}

interface AuthContextType {
  user: CachedUser | null;
  isLoading: boolean;
  authLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<CachedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuth = async () => {
    try {
      setIsLoading(true);
      const currentUser = await authManager.getCurrentUser();
      setUser(currentUser || null);
    } catch (__error) {
// console.log('🔐 AuthContext: Error refreshing auth:', __error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      authManager.clearCache();
      setUser(null);
    } catch (__error) {
      console.error('🔐 AuthContext: Error signing out:', __error);
    }
  };

  useEffect(() => {
    // Initial auth check
    refreshAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
// console.log('🔐 AuthContext: Auth state changed:', event);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            const cachedUser: CachedUser = {
              id: session.user.id,
              email: session.user.email || '',
              username: session.user.user_metadata?.username,
              avatar_url: session.user.user_metadata?.avatar_url,
              cached_at: Date.now()
            };
            setUser(cachedUser);
          } else {
            setUser(null);
          }
          setIsLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsLoading(false);
          authManager.clearCache();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    authLoading: isLoading,
    isAuthenticated: !!user,
    signOut,
    refreshAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook to safely check auth state without throwing errors
export function useAuthSafe(): AuthContextType | null {
  try {
    return useAuth();
  } catch {
    return null;
  }
}
