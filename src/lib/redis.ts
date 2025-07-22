import { createClient } from 'redis';

let client: ReturnType<typeof createClient> | null = null;

export async function getRedisClient() {
    if (client && client.isOpen) {
        return client;
    }
    
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        throw new Error('REDIS_URL environment variable is not set. Please add it to your .env file.');
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