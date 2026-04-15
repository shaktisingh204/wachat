'use server';

export async function executeClickHouseAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output: Record<string, any> } | { error: string }> {
    try {
        const { host, port, username, password } = inputs;
        const baseUrl = `${host}:${port ?? 8123}`;
        const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
        const headers: Record<string, string> = {
            'Authorization': authHeader,
            'Content-Type': 'text/plain',
        };

        const runQuery = async (sql: string, format = 'JSON') => {
            const url = `${baseUrl}/?query=${encodeURIComponent(`${sql} FORMAT ${format}`)}`;
            const res = await fetch(url, { method: 'GET', headers });
            if (!res.ok) {
                const text = await res.text();
                return { error: text || 'ClickHouse query failed' };
            }
            if (format === 'JSON') {
                const data = await res.json();
                return { output: data };
            }
            const text = await res.text();
            return { output: { result: text } };
        };

        const postQuery = async (sql: string) => {
            const res = await fetch(baseUrl, {
                method: 'POST',
                headers,
                body: sql,
            });
            if (!res.ok) {
                const text = await res.text();
                return { error: text || 'ClickHouse POST query failed' };
            }
            const text = await res.text();
            return { output: { result: text.trim() || 'OK' } };
        };

        switch (actionName) {
            case 'query': {
                return runQuery(inputs.query, inputs.format ?? 'JSON');
            }

            case 'insert': {
                const sql = `INSERT INTO ${inputs.table} FORMAT JSONEachRow`;
                const body = Array.isArray(inputs.data)
                    ? inputs.data.map((row: any) => JSON.stringify(row)).join('\n')
                    : JSON.stringify(inputs.data);
                const res = await fetch(`${baseUrl}/?query=${encodeURIComponent(sql)}`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/octet-stream' },
                    body,
                });
                if (!res.ok) {
                    const text = await res.text();
                    return { error: text || 'insert failed' };
                }
                return { output: { success: true } };
            }

            case 'listDatabases': {
                return runQuery('SHOW DATABASES');
            }

            case 'createDatabase': {
                return postQuery(`CREATE DATABASE IF NOT EXISTS \`${inputs.database}\``);
            }

            case 'dropDatabase': {
                return postQuery(`DROP DATABASE IF EXISTS \`${inputs.database}\``);
            }

            case 'listTables': {
                const db = inputs.database ? ` FROM \`${inputs.database}\`` : '';
                return runQuery(`SHOW TABLES${db}`);
            }

            case 'createTable': {
                const sql = inputs.createStatement
                    ?? `CREATE TABLE IF NOT EXISTS \`${inputs.database}\`.\`${inputs.table}\` (${inputs.columns}) ENGINE = ${inputs.engine ?? 'MergeTree()'} ORDER BY ${inputs.orderBy ?? 'tuple()'}`;
                return postQuery(sql);
            }

            case 'dropTable': {
                return postQuery(`DROP TABLE IF EXISTS \`${inputs.database}\`.\`${inputs.table}\``);
            }

            case 'listColumns': {
                return runQuery(`DESCRIBE TABLE \`${inputs.database}\`.\`${inputs.table}\``);
            }

            case 'describeTable': {
                return runQuery(`DESCRIBE TABLE \`${inputs.database}\`.\`${inputs.table}\``);
            }

            case 'insertBatch': {
                const rows: any[] = inputs.rows;
                if (!Array.isArray(rows) || rows.length === 0) {
                    return { error: 'rows must be a non-empty array' };
                }
                const sql = `INSERT INTO ${inputs.database ? `\`${inputs.database}\`.` : ''}\`${inputs.table}\` FORMAT JSONEachRow`;
                const body = rows.map((row: any) => JSON.stringify(row)).join('\n');
                const res = await fetch(`${baseUrl}/?query=${encodeURIComponent(sql)}`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/octet-stream' },
                    body,
                });
                if (!res.ok) {
                    const text = await res.text();
                    return { error: text || 'insertBatch failed' };
                }
                return { output: { success: true, rowsInserted: rows.length } };
            }

            case 'truncateTable': {
                return postQuery(`TRUNCATE TABLE IF EXISTS \`${inputs.database}\`.\`${inputs.table}\``);
            }

            case 'optimizeTable': {
                let sql = `OPTIMIZE TABLE \`${inputs.database}\`.\`${inputs.table}\``;
                if (inputs.final) sql += ' FINAL';
                if (inputs.deduplicate) sql += ' DEDUPLICATE';
                return postQuery(sql);
            }

            case 'getTableStats': {
                return runQuery(
                    `SELECT table, sum(rows) AS rows, sum(bytes_on_disk) AS bytes_on_disk, sum(data_compressed_bytes) AS data_compressed_bytes FROM system.parts WHERE database = '${inputs.database}' AND table = '${inputs.table}' GROUP BY table`
                );
            }

            case 'listUsers': {
                return runQuery(`SELECT name, id, storage FROM system.users`);
            }

            default:
                return { error: `Unknown ClickHouse action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`ClickHouse action error: ${err?.message}`);
        return { error: err?.message ?? 'Unknown error in ClickHouse action' };
    }
}
