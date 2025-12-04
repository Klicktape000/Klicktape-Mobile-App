/**
 * Supabase Query Optimizer
 * Wraps Supabase queries with request management and optimization
 */

import { supabase } from '../supabase';
import { requestManager } from './requestManager';
import { logger } from './logger';

type SupabaseQueryBuilder = any;
type QueryOptions = {
  skipCache?: boolean;
  skipDeduplication?: boolean;
  timeout?: number;
};

/**
 * Optimized Supabase query wrapper
 */
class SupabaseOptimizer {
  /**
   * Execute a SELECT query with optimization
   */
  async select<T = any>(
    table: string,
    query: (builder: SupabaseQueryBuilder) => SupabaseQueryBuilder,
    options: QueryOptions = {}
  ): Promise<{ data: T[] | null; error: any }> {
    const queryParams = this.extractQueryParams(query);
    
    return requestManager.executeRequest(
      table,
      'select',
      async (signal) => {
        const builder = supabase.from(table);
        const finalQuery = query(builder);
        
        // Add abort signal support if available
        if (finalQuery.abortSignal) {
          finalQuery.abortSignal(signal);
        }
        
        const result = await finalQuery;
        
        if (result.error) {
          throw new Error(`Supabase query error: ${result.error.message}`);
        }
        
        return result;
      },
      queryParams,
      options
    );
  }

  /**
   * Execute an INSERT query with optimization
   */
  async insert<T = any>(
    table: string,
    data: any,
    options: QueryOptions = {}
  ): Promise<{ data: T[] | null; error: any }> {
    // Skip caching and deduplication for INSERT operations by default
    const insertOptions = {
      skipCache: true,
      skipDeduplication: true,
      ...options
    };

    return requestManager.executeRequest(
      table,
      'insert',
      async (signal) => {
        const result = await supabase
          .from(table)
          .insert(data);
        
        if (result.error) {
          throw new Error(`Supabase insert error: ${result.error.message}`);
        }
        
        return result;
      },
      { data },
      insertOptions
    );
  }

  /**
   * Execute an UPDATE query with optimization
   */
  async update<T = any>(
    table: string,
    data: any,
    query: (builder: SupabaseQueryBuilder) => SupabaseQueryBuilder,
    options: QueryOptions = {}
  ): Promise<{ data: T[] | null; error: any }> {
    const queryParams = { ...this.extractQueryParams(query), data };
    
    // Skip caching for UPDATE operations by default
    const updateOptions = {
      skipCache: true,
      ...options
    };

    return requestManager.executeRequest(
      table,
      'update',
      async (signal) => {
        const builder = (supabase as any).from(table).update(data);
        const finalQuery = query(builder);
        
        const result = await finalQuery;
        
        if (result.error) {
          throw new Error(`Supabase update error: ${result.error.message}`);
        }
        
        return result;
      },
      queryParams as Record<string, any>,
      updateOptions
    );
  }

  /**
   * Execute a DELETE query with optimization
   */
  async delete<T = any>(
    table: string,
    query: (builder: SupabaseQueryBuilder) => SupabaseQueryBuilder,
    options: QueryOptions = {}
  ): Promise<{ data: T[] | null; error: any }> {
    const queryParams = this.extractQueryParams(query);
    
    // Skip caching and deduplication for DELETE operations by default
    const deleteOptions = {
      skipCache: true,
      skipDeduplication: true,
      ...options
    };

    return requestManager.executeRequest(
      table,
      'delete',
      async (signal) => {
        const builder = supabase.from(table).delete();
        const finalQuery = query(builder);
        
        const result = await finalQuery;
        
        if (result.error) {
          throw new Error(`Supabase delete error: ${result.error.message}`);
        }
        
        return result;
      },
      queryParams,
      deleteOptions
    );
  }

  /**
   * Execute an RPC (stored procedure) call with optimization
   */
  async rpc<T = any>(
    functionName: string,
    params: Record<string, any> = {},
    options: QueryOptions = {}
  ): Promise<{ data: T | null; error: any }> {
    return requestManager.executeRequest(
      'rpc',
      functionName,
      async (signal) => {
        const result = await supabase.rpc(functionName, params as any);
        
        if (result.error) {
          throw new Error(`Supabase RPC error: ${result.error.message}`);
        }
        
        return result;
      },
      params as Record<string, any>,
      options
    );
  }

  /**
   * Execute auth operations with optimization
   */
  async auth<T = any>(
    operation: string,
    params: any = {},
    options: QueryOptions = {}
  ): Promise<T> {
    // Skip caching and deduplication for auth operations by default
    const authOptions = {
      skipCache: true,
      skipDeduplication: true,
      ...options
    };

    return requestManager.executeRequest(
      'auth',
      operation,
      async (signal) => {
        let result;
        
        switch (operation) {
          case 'signUp':
            result = await supabase.auth.signUp(params as any);
            break;
          case 'signIn':
            result = await supabase.auth.signInWithPassword(params as any);
            break;
          case 'signOut':
            result = await supabase.auth.signOut();
            break;
          case 'getUser':
            result = await supabase.auth.getUser();
            break;
          case 'getSession':
            result = await supabase.auth.getSession();
            break;
          default:
            throw new Error(`Unknown auth operation: ${operation}`);
        }
        
        if (result.error) {
          throw new Error(`Supabase auth error: ${result.error.message}`);
        }
        
        return result;
      },
      params,
      authOptions
    );
  }

  /**
   * Extract query parameters for caching/deduplication
   */
  private extractQueryParams(query: (builder: any) => any): Record<string, any> {
    // This is a simplified approach - in a real implementation,
    // you might want to parse the query builder more thoroughly
    try {
      // Create a chainable mock builder
      const createMockBuilder = (): any => {
        const builder: any = {
          select: (columns?: string) => {
            builder._select = columns;
            return builder;
          },
          eq: (column: string, value: any) => {
            builder._eq = { ...builder._eq, [column]: value };
            return builder;
          },
          neq: (column: string, value: any) => {
            builder._neq = { ...builder._neq, [column]: value };
            return builder;
          },
          gt: (column: string, value: any) => {
            builder._gt = { ...builder._gt, [column]: value };
            return builder;
          },
          gte: (column: string, value: any) => {
            builder._gte = { ...builder._gte, [column]: value };
            return builder;
          },
          lt: (column: string, value: any) => {
            builder._lt = { ...builder._lt, [column]: value };
            return builder;
          },
          lte: (column: string, value: any) => {
            builder._lte = { ...builder._lte, [column]: value };
            return builder;
          },
          like: (column: string, value: any) => {
            builder._like = { ...builder._like, [column]: value };
            return builder;
          },
          ilike: (column: string, value: any) => {
            builder._ilike = { ...builder._ilike, [column]: value };
            return builder;
          },
          in: (column: string, values: any[]) => {
            builder._in = { ...builder._in, [column]: values };
            return builder;
          },
          order: (column: string, options?: any) => {
            builder._order = { ...builder._order, [column]: options };
            return builder;
          },
          limit: (count: number) => {
            builder._limit = count;
            return builder;
          },
          range: (from: number, to: number) => {
            builder._range = { from, to };
            return builder;
          },
          single: () => {
            builder._single = true;
            return builder;
          },
          maybeSingle: () => {
            builder._maybeSingle = true;
            return builder;
          },
          _select: undefined,
          _eq: {},
          _neq: {},
          _gt: {},
          _gte: {},
          _lt: {},
          _lte: {},
          _like: {},
          _ilike: {},
          _in: {},
          _order: {},
          _limit: undefined,
          _range: undefined,
          _single: false,
          _maybeSingle: false
        };
        return builder;
      };

      const mockBuilder = createMockBuilder();
      query(mockBuilder);

      // Extract the accumulated parameters
      return {
        select: mockBuilder._select,
        eq: mockBuilder._eq,
        neq: mockBuilder._neq,
        gt: mockBuilder._gt,
        gte: mockBuilder._gte,
        lt: mockBuilder._lt,
        lte: mockBuilder._lte,
        like: mockBuilder._like,
        ilike: mockBuilder._ilike,
        in: mockBuilder._in,
        order: mockBuilder._order,
        limit: mockBuilder._limit,
        range: mockBuilder._range,
        single: mockBuilder._single,
        maybeSingle: mockBuilder._maybeSingle
      };
    } catch (error) {
      // Silently fail - query params extraction is optional
      return {};
    }
  }

  /**
   * Cancel all pending requests for cleanup
   */
  cancelAllRequests(): void {
    requestManager.cancelAllRequests();
  }

  /**
   * Cancel requests for a specific table
   */
  cancelRequestsFor(table: string, operation?: string): void {
    requestManager.cancelRequestsFor(table, operation);
  }

  /**
   * Get current optimization statistics
   */
  getStats() {
    return requestManager.getStats();
  }

  /**
   * Reset the optimizer (clear caches and cancel requests)
   */
  reset(): void {
    requestManager.reset();
  }
}

// Export singleton instance
export const supabaseOptimizer = new SupabaseOptimizer();

// Helper functions for common operations
export const optimizedSupabase = {
  from: (table: string) => ({
    select: (columns?: string, options?: QueryOptions) =>
      supabaseOptimizer.select(table, (builder) => builder.select(columns), options),
    
    insert: (data: any, options?: QueryOptions) =>
      supabaseOptimizer.insert(table, data, options),
    
    update: (data: any, options?: QueryOptions) => ({
      eq: (column: string, value: any) =>
        supabaseOptimizer.update(table, data, (builder) => builder.eq(column, value), options),
      match: (query: Record<string, any>) =>
        supabaseOptimizer.update(table, data, (builder) => {
          let result = builder;
          Object.entries(query).forEach(([key, val]) => {
            result = result.eq(key, val);
          });
          return result;
        }, options)
    }),
    
    delete: (options?: QueryOptions) => ({
      eq: (column: string, value: any) =>
        supabaseOptimizer.delete(table, (builder) => builder.eq(column, value), options),
      match: (query: Record<string, any>) =>
        supabaseOptimizer.delete(table, (builder) => {
          let result = builder;
          Object.entries(query).forEach(([key, val]) => {
            result = result.eq(key, val);
          });
          return result;
        }, options)
    })
  }),
  
  rpc: (functionName: string, params?: Record<string, any>, options?: QueryOptions) =>
    supabaseOptimizer.rpc(functionName, params, options),
  
  auth: {
    signUp: (params: any, options?: QueryOptions) =>
      supabaseOptimizer.auth('signUp', params, options),
    signInWithPassword: (params: any, options?: QueryOptions) =>
      supabaseOptimizer.auth('signIn', params, options),
    signOut: (options?: QueryOptions) =>
      supabaseOptimizer.auth('signOut', {}, options),
    getUser: (options?: QueryOptions) =>
      supabaseOptimizer.auth('getUser', {}, options),
    getSession: (options?: QueryOptions) =>
      supabaseOptimizer.auth('getSession', {}, options)
  }
};