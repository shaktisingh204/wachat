'use server';

export async function executeRedisEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const restUrl = (inputs.restUrl || '').replace(/\/$/, '');
        if (!restUrl) return { error: 'restUrl is required.' };
        if (!inputs.token) return { error: 'token is required.' };

        const headers = {
            Authorization: `Bearer ${inputs.token}`,
            'Content-Type': 'application/json',
        };

        const cmd = async (...args: (string | number)[]) => {
            const res = await fetch(`${restUrl}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(args),
            });
            const data = await res.json();
            if (!res.ok) return { error: data.error || data.message || 'Command failed.' };
            return { output: { result: data.result } };
        };

        const pipeline = async (commands: (string | number)[][]) => {
            const res = await fetch(`${restUrl}/pipeline`, {
                method: 'POST',
                headers,
                body: JSON.stringify(commands),
            });
            const data = await res.json();
            if (!res.ok) return { error: data.error || 'Pipeline failed.' };
            return { output: { results: data } };
        };

        switch (actionName) {
            case 'set': {
                const { key, value, ex, px, nx, xx } = inputs;
                if (!key || value === undefined) return { error: 'key and value are required.' };
                const args: (string | number)[] = ['SET', key, String(value)];
                if (ex) args.push('EX', Number(ex));
                if (px) args.push('PX', Number(px));
                if (nx) args.push('NX');
                if (xx) args.push('XX');
                return cmd(...args);
            }

            case 'get': {
                const { key } = inputs;
                if (!key) return { error: 'key is required.' };
                return cmd('GET', key);
            }

            case 'del': {
                const { keys } = inputs;
                if (!keys) return { error: 'keys is required.' };
                const keyList: string[] = Array.isArray(keys) ? keys : [keys];
                return cmd('DEL', ...keyList);
            }

            case 'exists': {
                const { keys } = inputs;
                if (!keys) return { error: 'keys is required.' };
                const keyList: string[] = Array.isArray(keys) ? keys : [keys];
                return cmd('EXISTS', ...keyList);
            }

            case 'expire': {
                const { key, seconds } = inputs;
                if (!key || seconds === undefined) return { error: 'key and seconds are required.' };
                return cmd('EXPIRE', key, Number(seconds));
            }

            case 'ttl': {
                const { key } = inputs;
                if (!key) return { error: 'key is required.' };
                return cmd('TTL', key);
            }

            case 'incr': {
                const { key } = inputs;
                if (!key) return { error: 'key is required.' };
                return cmd('INCR', key);
            }

            case 'incrby': {
                const { key, amount } = inputs;
                if (!key || amount === undefined) return { error: 'key and amount are required.' };
                return cmd('INCRBY', key, Number(amount));
            }

            case 'decr': {
                const { key } = inputs;
                if (!key) return { error: 'key is required.' };
                return cmd('DECR', key);
            }

            case 'decrby': {
                const { key, amount } = inputs;
                if (!key || amount === undefined) return { error: 'key and amount are required.' };
                return cmd('DECRBY', key, Number(amount));
            }

            case 'lpush': {
                const { key, values } = inputs;
                if (!key || !values) return { error: 'key and values are required.' };
                const vals: string[] = Array.isArray(values) ? values : [values];
                return cmd('LPUSH', key, ...vals);
            }

            case 'rpush': {
                const { key, values } = inputs;
                if (!key || !values) return { error: 'key and values are required.' };
                const vals: string[] = Array.isArray(values) ? values : [values];
                return cmd('RPUSH', key, ...vals);
            }

            case 'lpop': {
                const { key, count } = inputs;
                if (!key) return { error: 'key is required.' };
                return count ? cmd('LPOP', key, Number(count)) : cmd('LPOP', key);
            }

            case 'rpop': {
                const { key, count } = inputs;
                if (!key) return { error: 'key is required.' };
                return count ? cmd('RPOP', key, Number(count)) : cmd('RPOP', key);
            }

            case 'lrange': {
                const { key, start, stop } = inputs;
                if (!key || start === undefined || stop === undefined) return { error: 'key, start, and stop are required.' };
                return cmd('LRANGE', key, Number(start), Number(stop));
            }

            case 'llen': {
                const { key } = inputs;
                if (!key) return { error: 'key is required.' };
                return cmd('LLEN', key);
            }

            case 'hset': {
                const { key, field, value, fields } = inputs;
                if (!key) return { error: 'key is required.' };
                if (fields && typeof fields === 'object') {
                    const args: (string | number)[] = ['HSET', key];
                    for (const [f, v] of Object.entries(fields)) {
                        args.push(f, String(v));
                    }
                    return cmd(...args);
                }
                if (!field || value === undefined) return { error: 'field and value (or fields object) are required.' };
                return cmd('HSET', key, field, String(value));
            }

            case 'hget': {
                const { key, field } = inputs;
                if (!key || !field) return { error: 'key and field are required.' };
                return cmd('HGET', key, field);
            }

            case 'hdel': {
                const { key, fields } = inputs;
                if (!key || !fields) return { error: 'key and fields are required.' };
                const fieldList: string[] = Array.isArray(fields) ? fields : [fields];
                return cmd('HDEL', key, ...fieldList);
            }

            case 'hgetall': {
                const { key } = inputs;
                if (!key) return { error: 'key is required.' };
                return cmd('HGETALL', key);
            }

            case 'sadd': {
                const { key, members } = inputs;
                if (!key || !members) return { error: 'key and members are required.' };
                const memberList: string[] = Array.isArray(members) ? members : [members];
                return cmd('SADD', key, ...memberList);
            }

            case 'smembers': {
                const { key } = inputs;
                if (!key) return { error: 'key is required.' };
                return cmd('SMEMBERS', key);
            }

            case 'sismember': {
                const { key, member } = inputs;
                if (!key || member === undefined) return { error: 'key and member are required.' };
                return cmd('SISMEMBER', key, String(member));
            }

            case 'zadd': {
                const { key, score, member, members } = inputs;
                if (!key) return { error: 'key is required.' };
                if (members && Array.isArray(members)) {
                    const args: (string | number)[] = ['ZADD', key];
                    for (const m of members) {
                        args.push(Number(m.score), String(m.member));
                    }
                    return cmd(...args);
                }
                if (score === undefined || !member) return { error: 'score and member (or members array) are required.' };
                return cmd('ZADD', key, Number(score), String(member));
            }

            case 'zrange': {
                const { key, start, stop, withScores } = inputs;
                if (!key || start === undefined || stop === undefined) return { error: 'key, start, and stop are required.' };
                return withScores
                    ? cmd('ZRANGE', key, Number(start), Number(stop), 'WITHSCORES')
                    : cmd('ZRANGE', key, Number(start), Number(stop));
            }

            case 'zrank': {
                const { key, member } = inputs;
                if (!key || member === undefined) return { error: 'key and member are required.' };
                return cmd('ZRANK', key, String(member));
            }

            case 'mset': {
                const { pairs } = inputs;
                if (!pairs || typeof pairs !== 'object') return { error: 'pairs object is required.' };
                const args: string[] = ['MSET'];
                for (const [k, v] of Object.entries(pairs)) {
                    args.push(k, String(v));
                }
                return cmd(...args);
            }

            case 'mget': {
                const { keys } = inputs;
                if (!keys) return { error: 'keys is required.' };
                const keyList: string[] = Array.isArray(keys) ? keys : [keys];
                return cmd('MGET', ...keyList);
            }

            case 'keys': {
                const { pattern } = inputs;
                return cmd('KEYS', pattern || '*');
            }

            case 'scan': {
                const { cursor, match, count, type } = inputs;
                const args: (string | number)[] = ['SCAN', Number(cursor) || 0];
                if (match) args.push('MATCH', match);
                if (count) args.push('COUNT', Number(count));
                if (type) args.push('TYPE', type);
                return cmd(...args);
            }

            case 'flushDb': {
                const { async: asyncFlush } = inputs;
                return asyncFlush ? cmd('FLUSHDB', 'ASYNC') : cmd('FLUSHDB');
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
