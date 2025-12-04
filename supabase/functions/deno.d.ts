// Type definitions for Deno runtime in Supabase Edge Functions

declare global {
  namespace Deno {
    interface Env {
      get(key: string): string | undefined;
    }
    
    const env: Env;
  }
}

// Deno standard library modules
declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(
    handler: (request: Request) => Response | Promise<Response>,
    options?: { port?: number; hostname?: string }
  ): void;
  
  export interface ServeInit {
    port?: number;
    hostname?: string;
    signal?: AbortSignal;
  }
}

// Supabase JS client
declare module "https://esm.sh/@supabase/supabase-js@2" {
  export interface User {
    id: string;
    email?: string;
    [key: string]: any;
  }

  export interface AuthUser {
    user: User | null;
  }

  export interface AuthError {
    message: string;
    status?: number;
  }

  export interface AuthResponse {
    data: AuthUser;
    error: AuthError | null;
  }

  export interface ListUsersResponse {
    data: { users: User[] };
    error: any;
  }

  export interface DeleteUserResponse {
    data: any;
    error: any;
  }

  export interface SupabaseAuthAdmin {
    listUsers(): Promise<ListUsersResponse>;
    deleteUser(userId: string): Promise<DeleteUserResponse>;
  }

  export interface SupabaseAuth {
    getUser(): Promise<AuthResponse>;
    admin: SupabaseAuthAdmin;
  }

  export interface SupabaseClient {
    auth: SupabaseAuth;
  }
  
  export function createClient(
    supabaseUrl: string, 
    supabaseKey: string, 
    options?: any
  ): SupabaseClient;
}

export {};