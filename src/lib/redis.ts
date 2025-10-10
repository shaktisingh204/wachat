
import { createClient } from 'redis';

let client: ReturnType<typeof createClient> | null = null;

export async function getRedisClient() {
    if (client && client.isOpen) {
        return client;
    }
    
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        console.warn('REDIS_URL not set, some features may be unavailable. Defaulting to localhost.');
        // This allows local dev without Redis, but will fail in a clustered prod env
        return createClient({ url: 'redis://localhost:6379' });
    }
    
    client = createClient({
        url: redisUrl
    });

    client.on('error', (err) => console.error('Redis Client Error', err));

    try {
        await client.connect();
        return client;
    } catch(err) {
        console.error("Failed to connect to Redis:", err);
        client = null; // Reset on connection failure
        throw err;
    }
}
