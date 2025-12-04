/**
 * Redis Operations Wrapper with Timeout Handling and Retry Logic
 * Provides robust Redis operations with automatic retry, circuit breaker, and timeout management
 */

import { Redis } from '@upstash/redis';
import { CACHE_CONFIG } from '../config/redis';

// Get Redis configuration from environment variables
const redisUrl = process.env.EXPO_PUBLIC_UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN; // Only use secure token

// Initialize Redis client with connection validation
let redis: Redis | null = null;

const initializeRedis = (): Redis | null => {
  if (!redisUrl || !redisToken) {
// console.warn('⚠️ Redis configuration missing. URL or token not provided.');
    return null;
  }

  try {
    return new Redis({
      url: redisUrl,
      token: redisToken,
      retry: {
        retries: CACHE_CONFIG.RETRY.MAX_ATTEMPTS,
        backoff: (retryCount) => Math.min(
          CACHE_CONFIG.RETRY.BASE_DELAY * Math.pow(CACHE_CONFIG.RETRY.EXPONENTIAL_BASE, retryCount),
          CACHE_CONFIG.RETRY.MAX_DELAY
        ),
      },
    });
  } catch (__error) {
    console.error('❌ Failed to initialize Redis client:', __error);
    return null;
  }
};

// Initialize Redis client
redis = initializeRedis();

// Circuit breaker state
interface CircuitBreakerState {
  failures: number;
  successes: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

const circuitBreakerState: CircuitBreakerState = {
  failures: 0,
  successes: 0,
  lastFailureTime: 0,
  state: 'CLOSED',
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate retry delay with exponential backoff and jitter
 */
const calculateRetryDelay = (attempt: number): number => {
  const { BASE_DELAY, MAX_DELAY, EXPONENTIAL_BASE, JITTER } = CACHE_CONFIG.RETRY;
  
  let delay = BASE_DELAY * Math.pow(EXPONENTIAL_BASE, attempt - 1);
  delay = Math.min(delay, MAX_DELAY);
  
  if (JITTER) {
    // Add random jitter (±25%)
    const jitterRange = delay * 0.25;
    delay += (Math.random() - 0.5) * 2 * jitterRange;
  }
  
  return Math.max(delay, BASE_DELAY);
};

/**
 * Check if circuit breaker should allow operation
 */
const shouldAllowOperation = (): boolean => {
  const now = Date.now();
  const { FAILURE_THRESHOLD, TIMEOUT, MONITOR_WINDOW } = CACHE_CONFIG.CIRCUIT_BREAKER;
  
  switch (circuitBreakerState.state) {
    case 'CLOSED':
      return true;
      
    case 'OPEN':
      if (now - circuitBreakerState.lastFailureTime > TIMEOUT) {
        circuitBreakerState.state = 'HALF_OPEN';
        return true;
      }
      return false;
      
    case 'HALF_OPEN':
      return true;
      
    default:
      return true;
  }
};

/**
 * Record operation success for circuit breaker
 */
const recordSuccess = (): void => {
  const { SUCCESS_THRESHOLD } = CACHE_CONFIG.CIRCUIT_BREAKER;
  
  circuitBreakerState.successes++;
  
  if (circuitBreakerState.state === 'HALF_OPEN' && 
      circuitBreakerState.successes >= SUCCESS_THRESHOLD) {
    circuitBreakerState.state = 'CLOSED';
    circuitBreakerState.failures = 0;
    circuitBreakerState.successes = 0;
  }
};

/**
 * Record operation failure for circuit breaker
 */
const recordFailure = (): void => {
  const { FAILURE_THRESHOLD } = CACHE_CONFIG.CIRCUIT_BREAKER;
  
  circuitBreakerState.failures++;
  circuitBreakerState.lastFailureTime = Date.now();
  circuitBreakerState.successes = 0;
  
  if (circuitBreakerState.failures >= FAILURE_THRESHOLD) {
    circuitBreakerState.state = 'OPEN';
  }
};

/**
 * Check if error is a timeout error
 */
const isTimeoutError = (error: any): boolean => {
  const errorMessage = error?.message?.toLowerCase() || '';
  return errorMessage.includes('timeout') || 
         errorMessage.includes('timed out') ||
         errorMessage.includes('connection timeout') ||
         error?.code === 'TIMEOUT' ||
         error?.name === 'TimeoutError';
};

/**
 * Enhanced Redis operation wrapper with timeout and retry logic
 */
export const executeRedisOperation = async <T>(
  operation: () => Promise<T>,
  operationType: 'get' | 'set' | 'del' | 'batch' | 'critical' = 'get',
  customTimeout?: number
): Promise<T | null> => {
  // Check if Redis client is available
  if (!redis) {
// console.warn('⚠️ Redis client not available, skipping operation');
    return null;
  }

  // Check circuit breaker
  if (!shouldAllowOperation()) {
// console.warn('⚠️ Circuit breaker is open, skipping Redis operation');
    return null;
  }

  const maxAttempts = CACHE_CONFIG.RETRY.MAX_ATTEMPTS;
  let lastError: Error | null = null;

  // Determine timeout based on operation type
  const timeout = customTimeout || (() => {
    switch (operationType) {
      case 'batch': return CACHE_CONFIG.TIMEOUTS.BATCH_OPERATION;
      case 'critical': return CACHE_CONFIG.TIMEOUTS.CRITICAL_OPERATION;
      default: return CACHE_CONFIG.TIMEOUTS.COMMAND;
    }
  })();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Redis operation timed out after ${timeout}ms (attempt ${attempt})`));
        }, timeout);
      });

      // Race between operation and timeout
      const result = await Promise.race([
        operation(),
        timeoutPromise
      ]);

      // Success - record and return
      recordSuccess();
      return result;

    } catch (__error) {
      lastError = __error as Error;
      
      // Log timeout specifically
      if (isTimeoutError(__error)) {
// console.warn(`⏱️ Redis timeout on attempt ${attempt}/${maxAttempts}: ${(__error as Error).message}`);
      } else {
// console.warn(`⚠️ Redis operation failed on attempt ${attempt}/${maxAttempts}:`, __error);
      }

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        break;
      }

      // Calculate and wait for retry delay
      const delay = calculateRetryDelay(attempt);
// console.log(`⏳ Retrying Redis operation in ${delay}ms...`);
      await sleep(delay);
    }
  }

  // All attempts failed
  recordFailure();
  console.error(`🔴 Redis operation failed after ${maxAttempts} attempts:`, lastError);
  return null;
};

/**
 * Enhanced Redis health check with improved timeout and retry
 */
export const checkRedisHealth = async (): Promise<boolean> => {
  if (!redis) {
// console.warn('⚠️ Redis client not available for health check');
    return false;
  }

  try {
    const result = await executeRedisOperation(
      () => redis!.ping(),
      'critical',
      CACHE_CONFIG.TIMEOUTS.HEALTH_CHECK
    );
    
    const isHealthy = result === 'PONG';
    
    if (!isHealthy) {
// console.warn('⚠️ Redis health check failed. Circuit breaker state:', circuitBreakerState.state);
    }
    
    return isHealthy;
  } catch (__error) {
    console.error('❌ Redis health check error:', __error);
    return false;
  }
};

/**
 * Safe Redis get operation with timeout handling
 */
export const safeRedisGet = async <T>(
  key: string
): Promise<T | null> => {
  if (!redis) return null;
  
  return executeRedisOperation(() => redis!.get(key));
};

/**
 * Safe Redis set operation with timeout handling
 */
export const safeRedisSet = async (
  key: string,
  value: any,
  options?: any
): Promise<boolean> => {
  if (!redis) return false;
  
  const result = await executeRedisOperation(
    () => redis!.set(key, value, options),
    'set'
  );
  return result === 'OK';
};

/**
 * Safe Redis delete operation with timeout handling
 */
export const safeRedisDel = async (
  ...keys: string[]
): Promise<number> => {
  if (!redis) return 0;
  
  const result = await executeRedisOperation(
    () => redis!.del(...keys),
    'del'
  );
  return result || 0;
};

/**
 * Safe Redis batch operation with timeout handling
 */
export const safeRedisBatch = async <T>(
  operations: (() => Promise<T>)[]
): Promise<(T | null)[]> => {
  if (!redis) return operations.map(() => null);
  
  const results: (T | null)[] = [];
  
  for (const operation of operations) {
    const result = await executeRedisOperation(operation, 'batch');
    results.push(result);
  }
  
  return results;
};

/**
 * Get circuit breaker status for monitoring
 */
export const getCircuitBreakerStatus = () => ({
  ...circuitBreakerState,
  isOpen: circuitBreakerState.state === 'OPEN',
  isHalfOpen: circuitBreakerState.state === 'HALF_OPEN',
});

/**
 * Reset circuit breaker (for testing or manual recovery)
 */
export const resetCircuitBreaker = (): void => {
  circuitBreakerState.failures = 0;
  circuitBreakerState.successes = 0;
  circuitBreakerState.lastFailureTime = 0;
  circuitBreakerState.state = 'CLOSED';
// console.log('🔄 Redis circuit breaker reset');
};
