'use server';

export async function executeQuestDBAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = (inputs.host || 'http://localhost:9000').replace(/\/$/, '');

        const headers: Record<string, string> = {
            'Content-Type': 'application/x-www-form-urlencoded',
        };

        if (inputs.username) {
            const credentials = Buffer.from(`${inputs.username}:${inputs.password || ''}`).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
        }

        const execQuery = async (query: string) => {
            const url = `${baseUrl}/exec?query=${encodeURIComponent(query)}`;
            const res = await fetch(url, { method: 'GET', headers });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`QuestDB error ${res.status}: ${text}`);
            }
            return res.json();
        };

        const execPost = async (query: string) => {
            const res = await fetch(`${baseUrl}/exec`, {
                method: 'POST',
                headers,
                body: new URLSearchParams({ query }),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`QuestDB error ${res.status}: ${text}`);
            }
            return res.json();
        };

        switch (actionName) {
            case 'executeQuery': {
                const result = await execQuery(inputs.query);
                return { output: result };
            }

            case 'executeInsert': {
                const table = inputs.table;
                const columns = inputs.columns as string[];
                const values = inputs.values as any[];
                const formattedValues = values.map((v: any) =>
                    typeof v === 'string' ? `'${v}'` : v
                ).join(', ');
                const query = `INSERT INTO '${table}' (${columns.join(', ')}) VALUES (${formattedValues})`;
                const result = await execPost(query);
                return { output: result };
            }

            case 'executeCreate': {
                const result = await execPost(inputs.query || inputs.ddl);
                return { output: result };
            }

            case 'executeDrop': {
                const query = `DROP TABLE IF EXISTS '${inputs.table}'`;
                const result = await execPost(query);
                return { output: result };
            }

            case 'executeAlter': {
                const result = await execPost(inputs.query || inputs.ddl);
                return { output: result };
            }

            case 'listTables': {
                const result = await execQuery('SHOW TABLES');
                return { output: result };
            }

            case 'getTableInfo': {
                const result = await execQuery(`SHOW CREATE TABLE '${inputs.table}'`);
                return { output: result };
            }

            case 'listColumns': {
                const result = await execQuery(`SHOW COLUMNS FROM '${inputs.table}'`);
                return { output: result };
            }

            case 'getTableStats': {
                const result = await execQuery(`SELECT count() FROM '${inputs.table}'`);
                return { output: result };
            }

            case 'executeExport': {
                const url = `${baseUrl}/exp?query=${encodeURIComponent(inputs.query)}&fmt=${inputs.format || 'csv'}`;
                const res = await fetch(url, { method: 'GET', headers });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`QuestDB export error ${res.status}: ${text}`);
                }
                const data = await res.text();
                return { output: { data, format: inputs.format || 'csv' } };
            }

            case 'importData': {
                const formData = new FormData();
                formData.append('data', inputs.data);
                const importHeaders: Record<string, string> = {};
                if (inputs.username) {
                    const credentials = Buffer.from(`${inputs.username}:${inputs.password || ''}`).toString('base64');
                    importHeaders['Authorization'] = `Basic ${credentials}`;
                }
                const res = await fetch(`${baseUrl}/imp?name=${encodeURIComponent(inputs.table)}&overwrite=${inputs.overwrite || false}`, {
                    method: 'POST',
                    headers: importHeaders,
                    body: formData,
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`QuestDB import error ${res.status}: ${text}`);
                }
                const result = await res.json();
                return { output: result };
            }

            case 'executeUpdate': {
                const result = await execPost(inputs.query);
                return { output: result };
            }

            case 'executeDelete': {
                const query = inputs.query || `DELETE FROM '${inputs.table}' WHERE ${inputs.where}`;
                const result = await execPost(query);
                return { output: result };
            }

            case 'getTables': {
                const result = await execQuery('SELECT * FROM tables()');
                return { output: result };
            }

            case 'healthCheck': {
                const res = await fetch(`${baseUrl}/status`, { method: 'GET', headers });
                if (!res.ok) {
                    throw new Error(`QuestDB health check failed: ${res.status}`);
                }
                const result = await res.json();
                return { output: { status: 'ok', ...result } };
            }

            default:
                logger.log(`QuestDB: Unknown action "${actionName}"`);
                return { error: `Unknown QuestDB action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`QuestDB action error: ${err.message}`);
        return { error: err.message || 'Unknown QuestDB error' };
    }
}
