
'use server';

import { getErrorMessage } from '@/lib/utils';

// mysql2 package is required for MySQL actions.
// If not installed, actions will return a helpful error.
let mysql: any = null;
try {
    mysql = require('mysql2/promise');
} catch {
    // mysql2 not installed – stubs will surface a clear error
}

function getMysqlNotInstalledError(): { error: string } {
    return {
        error:
            'The "mysql2" package is not installed. Please run `npm install mysql2` in your project root and redeploy.',
    };
}

function buildConnectionConfig(inputs: any) {
    return {
        host: String(inputs.host ?? 'localhost'),
        port: Number(inputs.port ?? 3306),
        user: String(inputs.user ?? ''),
        password: String(inputs.password ?? ''),
        database: String(inputs.database ?? ''),
        ssl: inputs.ssl === true || inputs.ssl === 'true' ? {} : undefined,
        connectTimeout: 15000,
    };
}

async function withConnection<T>(inputs: any, fn: (conn: any) => Promise<T>): Promise<T> {
    const conn = await mysql.createConnection(buildConnectionConfig(inputs));
    try {
        return await fn(conn);
    } finally {
        try {
            await conn.end();
        } catch {
            // ignore close errors
        }
    }
}

export async function executeMysqlAction(
    actionName: string,
    inputs: any,
    _user: any,
    logger: any
) {
    if (!mysql) {
        return getMysqlNotInstalledError();
    }

    try {
        switch (actionName) {
            case 'executeQuery': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('"query" is required.');
                logger.log(`[MySQL] executeQuery`, { query });

                return await withConnection(inputs, async (conn) => {
                    const [result] = await conn.query(query);
                    if (Array.isArray(result)) {
                        return { output: { rows: result, affectedRows: null, insertId: null } };
                    }
                    return {
                        output: {
                            rows: [],
                            affectedRows: (result as any).affectedRows ?? 0,
                            insertId: (result as any).insertId ?? null,
                        },
                    };
                });
            }

            case 'selectRows': {
                const table = String(inputs.table ?? '').trim();
                if (!table) throw new Error('"table" is required.');
                const columns = String(inputs.columns ?? '*').trim() || '*';
                const whereClause = String(inputs.whereClause ?? '').trim();
                const limit = Number(inputs.limit ?? 100);
                const orderBy = String(inputs.orderBy ?? '').trim();

                let sql = `SELECT ${columns} FROM \`${table}\``;
                if (whereClause) sql += ` WHERE ${whereClause}`;
                if (orderBy) sql += ` ORDER BY ${orderBy}`;
                sql += ` LIMIT ${limit}`;

                logger.log(`[MySQL] selectRows`, { sql });

                return await withConnection(inputs, async (conn) => {
                    const [rows] = await conn.query(sql);
                    return { output: { rows, count: (rows as any[]).length } };
                });
            }

            case 'insertRow': {
                const table = String(inputs.table ?? '').trim();
                if (!table) throw new Error('"table" is required.');
                let data = inputs.data;
                if (typeof data === 'string') {
                    try { data = JSON.parse(data); } catch { throw new Error('"data" must be a valid JSON object.'); }
                }
                if (!data || typeof data !== 'object' || Array.isArray(data)) {
                    throw new Error('"data" must be a JSON object of column-value pairs.');
                }

                const columns = Object.keys(data).map((k: string) => `\`${k}\``).join(', ');
                const placeholders = Object.keys(data).map(() => '?').join(', ');
                const values = Object.values(data);
                const sql = `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`;

                logger.log(`[MySQL] insertRow`, { sql, values });

                return await withConnection(inputs, async (conn) => {
                    const [result] = await conn.execute(sql, values);
                    return {
                        output: {
                            insertId: (result as any).insertId ?? null,
                            affectedRows: (result as any).affectedRows ?? 0,
                        },
                    };
                });
            }

            case 'updateRows': {
                const table = String(inputs.table ?? '').trim();
                if (!table) throw new Error('"table" is required.');
                let data = inputs.data;
                if (typeof data === 'string') {
                    try { data = JSON.parse(data); } catch { throw new Error('"data" must be a valid JSON object.'); }
                }
                if (!data || typeof data !== 'object' || Array.isArray(data)) {
                    throw new Error('"data" must be a JSON object of column-value pairs.');
                }
                const whereClause = String(inputs.whereClause ?? '').trim();

                const setClauses = Object.keys(data).map((k: string) => `\`${k}\` = ?`).join(', ');
                const values: any[] = Object.values(data);
                let sql = `UPDATE \`${table}\` SET ${setClauses}`;
                if (whereClause) sql += ` WHERE ${whereClause}`;

                logger.log(`[MySQL] updateRows`, { sql, values });

                return await withConnection(inputs, async (conn) => {
                    const [result] = await conn.execute(sql, values);
                    return { output: { affectedRows: (result as any).affectedRows ?? 0 } };
                });
            }

            case 'deleteRows': {
                const table = String(inputs.table ?? '').trim();
                if (!table) throw new Error('"table" is required.');
                const whereClause = String(inputs.whereClause ?? '').trim();
                if (!whereClause) {
                    throw new Error('"whereClause" is required for deleteRows to prevent accidental full-table deletion.');
                }

                const sql = `DELETE FROM \`${table}\` WHERE ${whereClause}`;
                logger.log(`[MySQL] deleteRows`, { sql });

                return await withConnection(inputs, async (conn) => {
                    const [result] = await conn.query(sql);
                    return { output: { affectedRows: (result as any).affectedRows ?? 0 } };
                });
            }

            case 'countRows': {
                const table = String(inputs.table ?? '').trim();
                if (!table) throw new Error('"table" is required.');
                const whereClause = String(inputs.whereClause ?? '').trim();

                let sql = `SELECT COUNT(*) AS cnt FROM \`${table}\``;
                if (whereClause) sql += ` WHERE ${whereClause}`;

                logger.log(`[MySQL] countRows`, { sql });

                return await withConnection(inputs, async (conn) => {
                    const [rows] = await conn.query(sql);
                    const count = (rows as any[])[0]?.cnt ?? 0;
                    return { output: { count: Number(count) } };
                });
            }

            case 'tableExists': {
                const tableName = String(inputs.tableName ?? '').trim();
                const database = String(inputs.database ?? '').trim();
                if (!tableName) throw new Error('"tableName" is required.');
                if (!database) throw new Error('"database" is required.');

                const sql = `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`;
                logger.log(`[MySQL] tableExists`, { tableName, database });

                return await withConnection(inputs, async (conn) => {
                    const [rows] = await conn.execute(sql, [database, tableName]);
                    const cnt = Number((rows as any[])[0]?.cnt ?? 0);
                    return { output: { exists: cnt > 0 } };
                });
            }

            case 'listTables': {
                logger.log(`[MySQL] listTables`);

                return await withConnection(inputs, async (conn) => {
                    const [rows] = await conn.query(`SHOW TABLES`);
                    const tables = (rows as any[]).map((row: any) => Object.values(row)[0] as string);
                    return { output: { tables } };
                });
            }

            default:
                return { error: `MySQL action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const errorMsg = `[MySQL] Error in "${actionName}": ${getErrorMessage(e)}`;
        logger.log(errorMsg, { code: e.code });
        return { error: errorMsg };
    }
}
