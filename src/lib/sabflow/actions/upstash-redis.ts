'use server';

export async function executeUpstashRedisAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = inputs.token;
        const baseUrl = inputs.redisUrl?.replace(/\/$/, '');

        if (!token || !baseUrl) {
            return { error: 'Missing required credentials: token and redisUrl' };
        }

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        const request = async (commands: any[]) => {
            const res = await fetch(`${baseUrl}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(commands),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
            return data;
        };

        const single = async (cmd: string[]) => {
            const res = await fetch(`${baseUrl}/${cmd.map(encodeURIComponent).join('/')}`, {
                method: 'GET',
                headers,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
            return data;
        };

        const post = async (cmd: string, body?: any) => {
            const res = await fetch(`${baseUrl}/${cmd}`, {
                method: 'POST',
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
            return data;
        };

        logger.log(`Executing Upstash Redis action: ${actionName}`);

        switch (actionName) {
            case 'get': {
                const data = await single(['get', inputs.key]);
                return { output: { result: data.result } };
            }
            case 'set': {
                const parts = ['set', inputs.key, inputs.value];
                if (inputs.ex) parts.push('EX', inputs.ex);
                if (inputs.px) parts.push('PX', inputs.px);
                const data = await single(parts);
                return { output: { result: data.result } };
            }
            case 'del': {
                const keys = Array.isArray(inputs.keys) ? inputs.keys : [inputs.key];
                const data = await single(['del', ...keys]);
                return { output: { deleted: data.result } };
            }
            case 'exists': {
                const keys = Array.isArray(inputs.keys) ? inputs.keys : [inputs.key];
                const data = await single(['exists', ...keys]);
                return { output: { exists: data.result } };
            }
            case 'expire': {
                const data = await single(['expire', inputs.key, String(inputs.seconds)]);
                return { output: { result: data.result } };
            }
            case 'ttl': {
                const data = await single(['ttl', inputs.key]);
                return { output: { ttl: data.result } };
            }
            case 'incr': {
                const data = await single(['incr', inputs.key]);
                return { output: { value: data.result } };
            }
            case 'decr': {
                const data = await single(['decr', inputs.key]);
                return { output: { value: data.result } };
            }
            case 'lpush': {
                const values = Array.isArray(inputs.values) ? inputs.values : [inputs.value];
                const data = await single(['lpush', inputs.key, ...values]);
                return { output: { length: data.result } };
            }
            case 'rpush': {
                const values = Array.isArray(inputs.values) ? inputs.values : [inputs.value];
                const data = await single(['rpush', inputs.key, ...values]);
                return { output: { length: data.result } };
            }
            case 'lpop': {
                const data = await single(['lpop', inputs.key]);
                return { output: { value: data.result } };
            }
            case 'rpop': {
                const data = await single(['rpop', inputs.key]);
                return { output: { value: data.result } };
            }
            case 'lrange': {
                const start = inputs.start ?? 0;
                const stop = inputs.stop ?? -1;
                const data = await single(['lrange', inputs.key, String(start), String(stop)]);
                return { output: { values: data.result } };
            }
            case 'hset': {
                const fieldValue = typeof inputs.fields === 'object'
                    ? Object.entries(inputs.fields).flat()
                    : [inputs.field, inputs.value];
                const data = await single(['hset', inputs.key, ...fieldValue.map(String)]);
                return { output: { result: data.result } };
            }
            case 'hget': {
                const data = await single(['hget', inputs.key, inputs.field]);
                return { output: { value: data.result } };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Upstash Redis action error: ${err.message}`);
        return { error: err.message || 'Upstash Redis action failed' };
    }
}
