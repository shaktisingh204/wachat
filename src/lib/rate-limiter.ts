
import cache from './cache';

const RATE_LIMIT_PREFIX = 'rate-limit:';

/**
 * Checks if a given key has exceeded the rate limit.
 * @param key A unique identifier for the entity being rate-limited (e.g., IP address, user ID).
 * @param limit The maximum number of requests allowed within the time window.
 * @param windowMs The time window in milliseconds.
 * @returns A promise that resolves to an object indicating success or failure.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ success: boolean; error?: string }> {
  const cacheKey = `${RATE_LIMIT_PREFIX}${key}`;
  const now = Date.now();

  const records: number[] = cache.get(cacheKey) || [];
  
  // Remove records that are outside the current window
  const recentRecords = records.filter(timestamp => now - timestamp < windowMs);
  
  if (recentRecords.length >= limit) {
    const timeToWait = Math.ceil((windowMs - (now - recentRecords[0])) / 1000);
    return {
      success: false,
      error: `Too many requests. Please try again in ${timeToWait} seconds.`,
    };
  }

  // Add the current request's timestamp
  recentRecords.push(now);

  // Store the updated records in the cache
  const ttl = Math.ceil(windowMs / 1000); // ttl for the entire set of records
  cache.set(cacheKey, recentRecords, ttl);
  
  return { success: true };
}
