'use server';

export async function executeTimescaledbAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { restUrl, jwtToken } = inputs;

        if (!restUrl) return { error: 'TimescaleDB: restUrl is required.' };
        if (!jwtToken) return { error: 'TimescaleDB: jwtToken is required.' };

        const base = restUrl.replace(/\/$/, '');

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwtToken}`,
            Accept: 'application/json',
        };

        const pgGet = async (path: string): Promise<any> => {
            logger.log(`TimescaleDB GET ${path}`);
            const res = await fetch(`${base}${path}`, { method: 'GET', headers });
            const text = await res.text();
            if (!res.ok) throw new Error(`TimescaleDB GET ${path} failed (${res.status}): ${text}`);
            return text ? JSON.parse(text) : [];
        };

        const pgPost = async (path: string, body: any): Promise<any> => {
            logger.log(`TimescaleDB POST ${path}`);
            const res = await fetch(`${base}${path}`, {
                method: 'POST',
                headers: { ...headers, Prefer: 'return=representation' },
                body: JSON.stringify(body),
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`TimescaleDB POST ${path} failed (${res.status}): ${text}`);
            return text ? JSON.parse(text) : [];
        };

        const pgPatch = async (path: string, body: any): Promise<any> => {
            logger.log(`TimescaleDB PATCH ${path}`);
            const res = await fetch(`${base}${path}`, {
                method: 'PATCH',
                headers: { ...headers, Prefer: 'return=representation' },
                body: JSON.stringify(body),
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`TimescaleDB PATCH ${path} failed (${res.status}): ${text}`);
            return text ? JSON.parse(text) : [];
        };

        const pgDelete = async (path: string): Promise<void> => {
            logger.log(`TimescaleDB DELETE ${path}`);
            const res = await fetch(`${base}${path}`, { method: 'DELETE', headers });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`TimescaleDB DELETE ${path} failed (${res.status}): ${text}`);
            }
        };

        switch (actionName) {
            case 'query': {
                const {
                    tableName, select, where, limit, order,
                    rangeStart, rangeEnd, timeColumn,
                } = inputs;
                if (!tableName) return { error: 'TimescaleDB query: tableName is required.' };

                const params = new URLSearchParams();
                params.set('select', select ?? '*');
                if (limit !== undefined) params.set('limit', String(limit ?? 100));
                if (order) params.set('order', order);
                if (where) {
                    // allow raw filter strings like "id=eq.5&status=eq.active"
                    for (const [k, v] of new URLSearchParams(where)) params.set(k, v);
                }
                if (timeColumn && rangeStart) params.set(`${timeColumn}`, `gte.${rangeStart}`);
                if (timeColumn && rangeEnd) {
                    // append second filter — PostgREST allows duplicate keys for ranges
                    const url = `/${tableName}?${params.toString()}&${timeColumn}=lte.${encodeURIComponent(rangeEnd)}`;
                    const rows = await pgGet(url);
                    return { output: { rows: Array.isArray(rows) ? rows : [rows] } };
                }
                const rows = await pgGet(`/${tableName}?${params.toString()}`);
                return { output: { rows: Array.isArray(rows) ? rows : [rows] } };
            }

            case 'insert': {
                const { tableName, data } = inputs;
                if (!tableName) return { error: 'TimescaleDB insert: tableName is required.' };
                if (data === undefined || data === null) return { error: 'TimescaleDB insert: data is required.' };
                const payload = Array.isArray(data) ? data : [data];
                const rows = await pgPost(`/${tableName}`, payload);
                return { output: { rows: Array.isArray(rows) ? rows : [rows] } };
            }

            case 'update': {
                const { tableName, filters, data } = inputs;
                if (!tableName) return { error: 'TimescaleDB update: tableName is required.' };
                if (!filters) return { error: 'TimescaleDB update: filters is required (e.g. "id=eq.5").' };
                if (data === undefined || data === null) return { error: 'TimescaleDB update: data is required.' };
                const rows = await pgPatch(`/${tableName}?${filters}`, data);
                return { output: { rows: Array.isArray(rows) ? rows : [rows] } };
            }

            case 'delete': {
                const { tableName, filters } = inputs;
                if (!tableName) return { error: 'TimescaleDB delete: tableName is required.' };
                if (!filters) return { error: 'TimescaleDB delete: filters is required (e.g. "id=eq.5").' };
                await pgDelete(`/${tableName}?${filters}`);
                return { output: { deleted: true } };
            }

            case 'callRpc': {
                const { funcName, params } = inputs;
                if (!funcName) return { error: 'TimescaleDB callRpc: funcName is required.' };
                const result = await pgPost(`/rpc/${funcName}`, params ?? {});
                return { output: { result } };
            }

            case 'getTimeBuckets': {
                const {
                    tableName, timeColumn, interval,
                    startTime, endTime, aggregation, valueColumn,
                } = inputs;
                if (!tableName) return { error: 'TimescaleDB getTimeBuckets: tableName is required.' };
                if (!timeColumn) return { error: 'TimescaleDB getTimeBuckets: timeColumn is required.' };
                if (!interval) return { error: 'TimescaleDB getTimeBuckets: interval is required.' };
                if (!startTime) return { error: 'TimescaleDB getTimeBuckets: startTime is required.' };
                if (!endTime) return { error: 'TimescaleDB getTimeBuckets: endTime is required.' };

                const agg = aggregation ?? 'avg';
                const col = valueColumn ?? 'value';
                const sql = `SELECT time_bucket('${interval}', ${timeColumn}) as bucket, ${agg}(${col}) as value FROM ${tableName} WHERE ${timeColumn} >= '${startTime}' AND ${timeColumn} <= '${endTime}' GROUP BY bucket ORDER BY bucket`;

                const result = await pgPost('/rpc/execute_sql', { query: sql });
                const buckets = Array.isArray(result) ? result : (result?.rows ?? [result]);
                return { output: { buckets } };
            }

            case 'getLatestValue': {
                const { tableName, valueColumn, timeColumn, where } = inputs;
                if (!tableName) return { error: 'TimescaleDB getLatestValue: tableName is required.' };
                if (!valueColumn) return { error: 'TimescaleDB getLatestValue: valueColumn is required.' };
                if (!timeColumn) return { error: 'TimescaleDB getLatestValue: timeColumn is required.' };

                const params = new URLSearchParams();
                params.set('select', `${valueColumn},${timeColumn}`);
                params.set('order', `${timeColumn}.desc`);
                params.set('limit', '1');
                if (where) {
                    for (const [k, v] of new URLSearchParams(where)) params.set(k, v);
                }
                const rows: any[] = await pgGet(`/${tableName}?${params.toString()}`);
                const row = Array.isArray(rows) ? rows[0] : rows;
                return { output: { value: row?.[valueColumn], timestamp: row?.[timeColumn] } };
            }

            case 'insertTimeseriesPoint': {
                const { tableName, time, value, tags } = inputs;
                if (!tableName) return { error: 'TimescaleDB insertTimeseriesPoint: tableName is required.' };
                if (time === undefined) return { error: 'TimescaleDB insertTimeseriesPoint: time is required.' };
                if (value === undefined) return { error: 'TimescaleDB insertTimeseriesPoint: value is required.' };

                const payload = { time, value, ...(tags ?? {}) };
                await pgPost(`/${tableName}`, [payload]);
                return { output: { inserted: true } };
            }

            case 'getAggregated': {
                const {
                    tableName, interval, timeColumn, valueColumn,
                    startTime, endTime, aggregate,
                } = inputs;
                if (!tableName) return { error: 'TimescaleDB getAggregated: tableName is required.' };
                if (!timeColumn) return { error: 'TimescaleDB getAggregated: timeColumn is required.' };
                if (!valueColumn) return { error: 'TimescaleDB getAggregated: valueColumn is required.' };
                if (!startTime) return { error: 'TimescaleDB getAggregated: startTime is required.' };
                if (!endTime) return { error: 'TimescaleDB getAggregated: endTime is required.' };

                const agg = aggregate ?? 'avg';
                const bucket = interval ?? '1 hour';
                const sql = `SELECT time_bucket('${bucket}', ${timeColumn}) as bucket, ${agg}(${valueColumn}) as value FROM ${tableName} WHERE ${timeColumn} >= '${startTime}' AND ${timeColumn} <= '${endTime}' GROUP BY bucket ORDER BY bucket`;

                const result = await pgPost('/rpc/execute_sql', { query: sql });
                const data = Array.isArray(result) ? result : (result?.rows ?? []);
                return { output: { data } };
            }

            case 'listHypertables': {
                let hypertables: any[];
                try {
                    hypertables = await pgGet('/rpc/list_hypertables');
                } catch {
                    hypertables = await pgGet(
                        '/timescaledb_information.hypertables?select=hypertable_name,num_chunks,total_size'
                    );
                }
                return { output: { hypertables: Array.isArray(hypertables) ? hypertables : [] } };
            }

            default:
                return { error: `TimescaleDB: unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`TimescaleDB action error: ${err?.message}`);
        return { error: err?.message ?? 'TimescaleDB action failed.' };
    }
}
