
'use server';

function buildRedisUrl(inputs: any): string {
    const url = String(inputs.url ?? '').trim();
    if (url) return url;

    const host = String(inputs.host ?? '127.0.0.1').trim();
    const port = String(inputs.port ?? '6379').trim();
    const password = String(inputs.password ?? '').trim();

    if (password) {
        return `redis://:${encodeURIComponent(password)}@${host}:${port}`;
    }
    return `redis://${host}:${port}`;
}

export async function executeRedisAction(
    actionName: string,
    inputs: any,
    _user: any,
    logger: any
) {
    let redisClient: any = null;
    try {
        const url = buildRedisUrl(inputs);
        const { createClient } = await import('redis');

        redisClient = createClient({ url });
        redisClient.on('error', (_err: any) => { /* suppress event-emitter noise */ });
        await redisClient.connect();

        switch (actionName) {
            case 'get': {
                const key = String(inputs.key ?? '').trim();
                if (!key) throw new Error('"key" is required.');
                logger.log(`[Redis] GET ${key}`);
                const value = await redisClient.get(key);
                return { output: { key, value, found: value !== null } };
            }

            case 'set': {
                const key = String(inputs.key ?? '').trim();
                if (!key) throw new Error('"key" is required.');
                const value = inputs.value !== undefined ? String(inputs.value) : '';
                const expirySeconds = inputs.expirySeconds !== undefined && inputs.expirySeconds !== ''
                    ? Number(inputs.expirySeconds)
                    : null;
                logger.log(`[Redis] SET ${key}${expirySeconds ? ` EX ${expirySeconds}` : ''}`);
                const options: any = {};
                if (expirySeconds && expirySeconds > 0) options.EX = expirySeconds;
                await redisClient.set(key, value, Object.keys(options).length ? options : undefined);
                return { output: { key, set: true } };
            }

            case 'del': {
                const keyInput = inputs.key ?? inputs.keys;
                if (!keyInput) throw new Error('"key" or "keys" is required.');
                const keys: string[] = Array.isArray(keyInput)
                    ? keyInput.map(String)
                    : [String(keyInput)];
                logger.log(`[Redis] DEL ${keys.join(', ')}`);
                const deleted = await redisClient.del(keys);
                return { output: { deleted } };
            }

            case 'exists': {
                const key = String(inputs.key ?? '').trim();
                if (!key) throw new Error('"key" is required.');
                logger.log(`[Redis] EXISTS ${key}`);
                const count = await redisClient.exists(key);
                return { output: { key, exists: count > 0, count } };
            }

            case 'expire': {
                const key = String(inputs.key ?? '').trim();
                if (!key) throw new Error('"key" is required.');
                const seconds = Number(inputs.seconds ?? 0);
                if (!seconds || seconds <= 0) throw new Error('"seconds" must be a positive number.');
                logger.log(`[Redis] EXPIRE ${key} ${seconds}`);
                const result = await redisClient.expire(key, seconds);
                return { output: { key, applied: result === 1 } };
            }

            case 'ttl': {
                const key = String(inputs.key ?? '').trim();
                if (!key) throw new Error('"key" is required.');
                logger.log(`[Redis] TTL ${key}`);
                const ttl = await redisClient.ttl(key);
                return { output: { key, ttl } };
            }

            case 'hget': {
                const key = String(inputs.key ?? '').trim();
                const field = String(inputs.field ?? '').trim();
                if (!key) throw new Error('"key" is required.');
                if (!field) throw new Error('"field" is required.');
                logger.log(`[Redis] HGET ${key} ${field}`);
                const value = await redisClient.hGet(key, field);
                return { output: { key, field, value, found: value !== null } };
            }

            case 'hset': {
                const key = String(inputs.key ?? '').trim();
                const field = String(inputs.field ?? '').trim();
                if (!key) throw new Error('"key" is required.');
                if (!field) throw new Error('"field" is required.');
                const value = inputs.value !== undefined ? String(inputs.value) : '';
                logger.log(`[Redis] HSET ${key} ${field}`);
                await redisClient.hSet(key, field, value);
                return { output: { key, field, set: true } };
            }

            case 'hgetall': {
                const key = String(inputs.key ?? '').trim();
                if (!key) throw new Error('"key" is required.');
                logger.log(`[Redis] HGETALL ${key}`);
                const hash = await redisClient.hGetAll(key);
                return { output: { key, hash, count: Object.keys(hash ?? {}).length } };
            }

            case 'lpush': {
                const key = String(inputs.key ?? '').trim();
                if (!key) throw new Error('"key" is required.');
                const value = inputs.value !== undefined ? String(inputs.value) : '';
                logger.log(`[Redis] LPUSH ${key}`);
                const length = await redisClient.lPush(key, value);
                return { output: { key, listLength: length } };
            }

            case 'rpush': {
                const key = String(inputs.key ?? '').trim();
                if (!key) throw new Error('"key" is required.');
                const value = inputs.value !== undefined ? String(inputs.value) : '';
                logger.log(`[Redis] RPUSH ${key}`);
                const length = await redisClient.rPush(key, value);
                return { output: { key, listLength: length } };
            }

            case 'lpop': {
                const key = String(inputs.key ?? '').trim();
                if (!key) throw new Error('"key" is required.');
                logger.log(`[Redis] LPOP ${key}`);
                const value = await redisClient.lPop(key);
                return { output: { key, value, found: value !== null } };
            }

            case 'rpop': {
                const key = String(inputs.key ?? '').trim();
                if (!key) throw new Error('"key" is required.');
                logger.log(`[Redis] RPOP ${key}`);
                const value = await redisClient.rPop(key);
                return { output: { key, value, found: value !== null } };
            }

            case 'lrange': {
                const key = String(inputs.key ?? '').trim();
                if (!key) throw new Error('"key" is required.');
                const start = Number(inputs.start ?? 0);
                const stop = Number(inputs.stop ?? -1);
                logger.log(`[Redis] LRANGE ${key} ${start} ${stop}`);
                const items = await redisClient.lRange(key, start, stop);
                return { output: { key, items, count: items.length } };
            }

            case 'incr': {
                const key = String(inputs.key ?? '').trim();
                if (!key) throw new Error('"key" is required.');
                logger.log(`[Redis] INCR ${key}`);
                const value = await redisClient.incr(key);
                return { output: { key, value } };
            }

            case 'decr': {
                const key = String(inputs.key ?? '').trim();
                if (!key) throw new Error('"key" is required.');
                logger.log(`[Redis] DECR ${key}`);
                const value = await redisClient.decr(key);
                return { output: { key, value } };
            }

            case 'keys': {
                const pattern = String(inputs.pattern ?? '*').trim();
                logger.log(`[Redis] KEYS ${pattern}`);
                const keys = await redisClient.keys(pattern);
                return { output: { keys, count: keys.length } };
            }

            case 'flushdb': {
                logger.log(`[Redis] FLUSHDB`);
                await redisClient.flushDb();
                return { output: { flushed: true } };
            }

            default:
                return { error: `Redis action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e.message || 'Redis action failed.';
        logger.log(`[Redis] Error in "${actionName}": ${msg}`);
        return { error: msg };
    } finally {
        if (redisClient) {
            try {
                await redisClient.quit();
            } catch {
                // ignore close errors
            }
        }
    }
}
