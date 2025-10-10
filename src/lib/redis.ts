
import { createClient } from 'redis';

let client: ReturnType<typeof createClient> | null = null;

export async function getRedisClient() {
    if (client && client.isOpen) {
        return client;
    }
    
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        console.warn('REDIS_URL not set. Broadcast queue will not work. Please add it to your .env file.');
        // Return a mock client if Redis is not configured
        return {
            lPush: async () => {},
            brPop: async () => { await new Promise(resolve => setTimeout(resolve, 60000)); return null; },
            on: () => {},
            connect: async () => {},
            isOpen: false,
        } as any;
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
