// utils/cache.js
import NodeCache from 'node-cache';

// Create cache instance with default TTL of 5 minutes
export const cache = new NodeCache({
  stdTTL: 300, // 5 minutes
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: true // Use deep clones for objects
});

// Helper functions for common cache operations
export const cacheUtils = {
  // Get data with key prefix
  get: (prefix, key) => {
    return cache.get(`${prefix}_${key}`);
  },
  
  // Set data with key prefix and optional TTL
  set: (prefix, key, value, ttl = 300) => {
    return cache.set(`${prefix}_${key}`, value, ttl);
  },
  
  // Delete data with key prefix
  del: (prefix, key) => {
    return cache.del(`${prefix}_${key}`);
  },
  
  // Clear all keys with a specific prefix
  clearPrefix: (prefix) => {
    const keys = cache.keys();
    const prefixKeys = keys.filter(key => key.startsWith(`${prefix}_`));
    cache.del(prefixKeys);
    return prefixKeys.length;
  },
  
  // Clear entire cache
  clear: () => {
    return cache.flushAll();
  },
  
  // Get cache statistics
  stats: () => {
    return cache.getStats();
  }
};
