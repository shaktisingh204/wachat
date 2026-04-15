
'use server';

export async function executePostgresqlAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const connectionString = String(inputs.connectionString ?? '').trim();
        const host = String(inputs.host ?? '').trim();
        const port = Number(inputs.port ?? 5432);
        const database = String(inputs.database ?? '').trim();
        const pgUser = String(inputs.user ?? '').trim();
        const password = String(inputs.password ?? '').trim();
        const ssl = inputs.ssl === true || inputs.ssl === 'true';

        if (!connectionString && (!host || !database || !pgUser)) {
            throw new Error('connectionString or host, database, and user are required.');
        }

        // Dynamic import to avoid issues in environments without pg installed
        const { Client } = await import('pg');
        const clientConfig = connectionString
            ? { connectionString, ssl: ssl ? { rejectUnauthorized: false } : false }
            : { host, port, database, user: pgUser, password, ssl: ssl ? { rejectUnauthorized: false } : false };

        const client = new Client(clientConfig);
        await client.connect();

        try {
            switch (actionName) {
                case 'executeQuery': {
                    const query = String(inputs.query ?? '').trim();
                    if (!query) throw new Error('query is required.');
                    const params = inputs.params ? (Array.isArray(inputs.params) ? inputs.params : JSON.parse(String(inputs.params))) : [];
                    logger.log(`[PostgreSQL] Executing query`);
                    const result = await client.query(query, params);
                    logger.log(`[PostgreSQL] Query returned ${result.rowCount} rows`);
                    return { output: { rows: result.rows, rowCount: String(result.rowCount), command: result.command } };
                }

                case 'insert': {
                    const table = String(inputs.table ?? '').trim();
                    const data = inputs.data;
                    if (!table || !data) throw new Error('table and data are required.');
                    const dataObj = typeof data === 'string' ? JSON.parse(data) : data;
                    const keys = Object.keys(dataObj);
                    const values = keys.map(k => dataObj[k]);
                    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
                    const query = `INSERT INTO ${table} (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders}) RETURNING *`;
                    logger.log(`[PostgreSQL] Insert into ${table}`);
                    const result = await client.query(query, values);
                    return { output: { inserted: result.rows[0] ?? {}, rowCount: String(result.rowCount) } };
                }

                case 'update': {
                    const table = String(inputs.table ?? '').trim();
                    const data = inputs.data;
                    const where = String(inputs.where ?? '').trim();
                    const whereParams = inputs.whereParams;
                    if (!table || !data || !where) throw new Error('table, data, and where are required.');
                    const dataObj = typeof data === 'string' ? JSON.parse(data) : data;
                    const keys = Object.keys(dataObj);
                    const values = keys.map(k => dataObj[k]);
                    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
                    const whereParamsArr = whereParams ? (Array.isArray(whereParams) ? whereParams : JSON.parse(String(whereParams))) : [];
                    const allParams = [...values, ...whereParamsArr];
                    const adjustedWhere = where.replace(/\$(\d+)/g, (m: string, n: string) => `$${parseInt(n) + keys.length}`);
                    const query = `UPDATE ${table} SET ${setClause} WHERE ${adjustedWhere} RETURNING *`;
                    logger.log(`[PostgreSQL] Update ${table}`);
                    const result = await client.query(query, allParams);
                    return { output: { updated: result.rows, rowCount: String(result.rowCount) } };
                }

                case 'delete': {
                    const table = String(inputs.table ?? '').trim();
                    const where = String(inputs.where ?? '').trim();
                    const params = inputs.params ? (Array.isArray(inputs.params) ? inputs.params : JSON.parse(String(inputs.params))) : [];
                    if (!table || !where) throw new Error('table and where are required.');
                    const query = `DELETE FROM ${table} WHERE ${where} RETURNING *`;
                    logger.log(`[PostgreSQL] Delete from ${table}`);
                    const result = await client.query(query, params);
                    return { output: { deleted: result.rows, rowCount: String(result.rowCount) } };
                }

                case 'select': {
                    const table = String(inputs.table ?? '').trim();
                    const columns = String(inputs.columns ?? '*').trim();
                    const where = String(inputs.where ?? '').trim();
                    const limit = inputs.limit ? Number(inputs.limit) : undefined;
                    const orderBy = String(inputs.orderBy ?? '').trim();
                    const params = inputs.params ? (Array.isArray(inputs.params) ? inputs.params : JSON.parse(String(inputs.params))) : [];
                    if (!table) throw new Error('table is required.');
                    let query = `SELECT ${columns} FROM ${table}`;
                    if (where) query += ` WHERE ${where}`;
                    if (orderBy) query += ` ORDER BY ${orderBy}`;
                    if (limit) query += ` LIMIT ${limit}`;
                    logger.log(`[PostgreSQL] Select from ${table}`);
                    const result = await client.query(query, params);
                    return { output: { rows: result.rows, rowCount: String(result.rowCount) } };
                }

                case 'executeTransaction': {
                    const queries = inputs.queries;
                    if (!queries) throw new Error('queries is required.');
                    const queriesArr = Array.isArray(queries) ? queries : JSON.parse(String(queries));
                    logger.log(`[PostgreSQL] Executing transaction with ${queriesArr.length} queries`);
                    await client.query('BEGIN');
                    const results = [];
                    try {
                        for (const q of queriesArr) {
                            const sql = typeof q === 'string' ? q : q.query;
                            const qParams = typeof q === 'object' ? (q.params ?? []) : [];
                            const r = await client.query(sql, qParams);
                            results.push({ rowCount: r.rowCount, rows: r.rows });
                        }
                        await client.query('COMMIT');
                    } catch (e) {
                        await client.query('ROLLBACK');
                        throw e;
                    }
                    return { output: { results, queryCount: String(queriesArr.length) } };
                }

                case 'listTables': {
                    const result = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
                    return { output: { tables: result.rows.map((r: any) => r.table_name), count: String(result.rowCount) } };
                }

                case 'describeTable': {
                    const table = String(inputs.table ?? '').trim();
                    if (!table) throw new Error('table is required.');
                    const result = await client.query(
                        `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
                        [table]
                    );
                    return { output: { columns: result.rows, columnCount: String(result.rowCount) } };
                }

                default:
                    return { error: `PostgreSQL action "${actionName}" is not implemented.` };
            }
        } finally {
            await client.end();
        }
    } catch (e: any) {
        return { error: e.message || 'PostgreSQL action failed.' };
    }
}
