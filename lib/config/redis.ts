/**
 * Redis Configuration for Klicktape Stories
 * Environment setup and connection management
 */

// Get Redis configuration from environment variables
const redisUrl = process.env.EXPO_PUBLIC_UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN; // Only use secure token

export const REDIS_CONFIG = {
  url: redisUrl || '',
  token: redisToken || '',
  enabled: !!(redisUrl && redisToken),
};

// Cache configuration
export const CACHE_CONFIG = {
  // TTL values in seconds
  TTL: {
    STORIES_FEED: 300, // 5 minutes
    USER_STORIES: 600, // 10 minutes
    STORY_VIEWS: 3600, // 1 hour
    STORY_INTERACTIONS: 1800, // 30 minutes
    ACTIVE_STORIES: 180, // 3 minutes
    STORY_ANALYTICS: 7200, // 2 hours
    REELS_FEED: 300, // 5 minutes
    USER_REELS: 600, // 10 minutes
    REEL_DETAILS: 900, // 15 minutes
    REEL_LIKES: 180, // 3 minutes
    REEL_BOOKMARKS: 300, // 5 minutes
    TRENDING_REELS: 1800, // 30 minutes
    REEL_ANALYTICS: 3600, // 1 hour
    REEL_VIEWS: 1800, // 30 minutes
    REEL_INTERACTIONS: 600, // 10 minutes
    EXPLORE_REELS: 900, // 15 minutes
  },
  
  // Cache key prefixes
  KEYS: {
    STORIES_FEED: 'stories:feed',
    USER_STORIES: 'stories:user:',
    STORY_VIEWS: 'stories:views:',
    STORY_INTERACTIONS: 'stories:interactions:',
    ACTIVE_STORIES: 'stories:active',
    STORY_ANALYTICS: 'stories:analytics:',
    REELS_FEED: 'reels:feed',
    USER_REELS: 'reels:user:',
    REEL_DETAILS: 'reels:detail:',
    REEL_LIKES: 'reels:likes:',
    REEL_BOOKMARKS: 'reels:bookmarks:',
    TRENDING_REELS: 'reels:trending',
    REEL_ANALYTICS: 'reels:analytics:',
    REEL_VIEWS: 'reels:views:',
    REEL_INTERACTIONS: 'reels:interactions:',
    EXPLORE_REELS: 'reels:explore',
  },
  
  // Performance settings
  BATCH_SIZE: 50,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // milliseconds
  
  // Timeout configurations (in milliseconds) - Balanced for reliability and performance
  TIMEOUTS: {
    CONNECTION: 8000, // 8 seconds for initial connection (increased for network stability)
    COMMAND: 4000, // 4 seconds for individual commands (increased for reliability)
    HEALTH_CHECK: 5000, // 5 seconds for health checks (increased for network latency)
    BATCH_OPERATION: 10000, // 10 seconds for batch operations (increased for complex ops)
    CRITICAL_OPERATION: 6000, // 6 seconds for critical operations (increased for reliability)
  },
  
  // Retry configuration - Optimized for faster recovery
  RETRY: {
    MAX_ATTEMPTS: 2, // Reduced from 3 to fail faster
    BASE_DELAY: 500, // Reduced base delay from 1000ms
    MAX_DELAY: 2000, // Reduced max delay from 5000ms
    EXPONENTIAL_BASE: 1.5, // Reduced from 2 for gentler backoff
    JITTER: true, // Add random jitter to prevent thundering herd
  },
  
  // Circuit breaker configuration
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: 5, // Number of failures before opening circuit
    SUCCESS_THRESHOLD: 3, // Number of successes to close circuit
    TIMEOUT: 60000, // Circuit breaker timeout (1 minute)
    MONITOR_WINDOW: 300000, // Monitoring window (5 minutes)
  },
  
  // Connection pool settings
  CONNECTION_POOL: {
    MIN_CONNECTIONS: 1,
    MAX_CONNECTIONS: 10,
    IDLE_TIMEOUT: 30000, // 30 seconds
    ACQUIRE_TIMEOUT: 10000, // 10 seconds
  },
};

// Validate Redis configuration
export const validateRedisConfig = (): boolean => {
  if (!REDIS_CONFIG.enabled) {
    // Warning: Redis is not configured
    return false;
  }
  
  if (!REDIS_CONFIG.url || !REDIS_CONFIG.token) {
    console.error('❌ Redis configuration is incomplete');
    return false;
  }

// console.log('✅ Redis configuration is valid');
  return true;
};

export default REDIS_CONFIG;

