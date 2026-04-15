
'use server';

const SNOWFLAKE_POLL_INTERVAL_MS = 1500;
const SNOWFLAKE_MAX_POLL_ATTEMPTS = 20; // ~30s

interface SnowflakeStatementResult {
    statementHandle: string;
    status: string;
    data: any[][];
    resultSetMetaData?: { rowType: { name: string }[] };
}

async function snowflakeFetch(
    accountIdentifier: string,
    jwt: string,
    method: string,
    path: string,
    body?: any,
    logger?: any,
): Promise<any> {
    logger?.log(`[Snowflake] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${jwt}`,
            'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT',
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const baseUrl = `https://${accountIdentifier}.snowflakecomputing.com/api/v2`;
    const res = await fetch(`${baseUrl}${path}`, options);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok && res.status !== 202) {
        throw new Error(data?.message || data?.error || `Snowflake API error: ${res.status}`);
    }
    return { statusCode: res.status, data };
}

async function pollStatement(
    accountIdentifier: string,
    jwt: string,
    statementHandle: string,
    logger?: any,
): Promise<SnowflakeStatementResult> {
    for (let attempt = 0; attempt < SNOWFLAKE_MAX_POLL_ATTEMPTS; attempt++) {
        const { statusCode, data } = await snowflakeFetch(
            accountIdentifier,
            jwt,
            'GET',
            `/statements/${statementHandle}`,
            undefined,
            logger,
        );
        const status: string = data?.statementStatusUrl ? 'running' : (data?.status ?? 'unknown');
        const resolvedStatus = statusCode === 200 ? 'success' : (statusCode === 202 ? 'running' : 'failed');
        if (resolvedStatus === 'success') {
            return {
                statementHandle,
                status: 'success',
                data: data?.data ?? [],
                resultSetMetaData: data?.resultSetMetaData,
            };
        }
        if (resolvedStatus === 'failed') {
            throw new Error(data?.message || `Statement ${statementHandle} failed.`);
        }
        // still running — wait before next poll
        await new Promise(resolve => setTimeout(resolve, SNOWFLAKE_POLL_INTERVAL_MS));
    }
    throw new Error(`Statement ${statementHandle} timed out after ${SNOWFLAKE_MAX_POLL_ATTEMPTS * SNOWFLAKE_POLL_INTERVAL_MS / 1000}s.`);
}

async function executeStatement(
    accountIdentifier: string,
    jwt: string,
    statement: string,
    options: {
        database?: string;
        schema?: string;
        warehouse?: string;
        role?: string;
        timeout?: number;
    } = {},
    logger?: any,
): Promise<SnowflakeStatementResult> {
    const body: any = {
        statement,
        timeout: options.timeout ?? 60,
    };
    if (options.database) body.database = options.database;
    if (options.schema) body.schema = options.schema;
    if (options.warehouse) body.warehouse = options.warehouse;
    if (options.role) body.role = options.role;

    const { statusCode, data } = await snowflakeFetch(accountIdentifier, jwt, 'POST', '/statements', body, logger);

    if (statusCode === 200) {
        // completed immediately
        return {
            statementHandle: data.statementHandle,
            status: 'success',
            data: data.data ?? [],
            resultSetMetaData: data.resultSetMetaData,
        };
    }

    if (statusCode === 202) {
        // async — poll until done
        const handle = data.statementHandle;
        if (!handle) throw new Error('Snowflake did not return a statementHandle for async execution.');
        return pollStatement(accountIdentifier, jwt, handle, logger);
    }

    throw new Error(data?.message || `Snowflake statement submission failed: ${statusCode}`);
}

function rowsToObjects(result: SnowflakeStatementResult): Record<string, any>[] {
    const columns = result.resultSetMetaData?.rowType?.map(c => c.name) ?? [];
    if (columns.length === 0) return result.data ?? [];
    return (result.data ?? []).map(row =>
        columns.reduce((obj, col, i) => {
            obj[col] = row[i];
            return obj;
        }, {} as Record<string, any>),
    );
}

export async function executeSnowflakeAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accountIdentifier = String(inputs.accountIdentifier ?? '').trim();
        const jwt = String(inputs.jwt ?? '').trim();
        if (!accountIdentifier) throw new Error('accountIdentifier is required.');
        if (!jwt) throw new Error('jwt is required.');

        const commonOpts = {
            database: inputs.database ? String(inputs.database).trim() : undefined,
            schema: inputs.schema ? String(inputs.schema).trim() : undefined,
            warehouse: inputs.warehouse ? String(inputs.warehouse).trim() : undefined,
            role: inputs.role ? String(inputs.role).trim() : undefined,
            timeout: inputs.timeout ? Number(inputs.timeout) : undefined,
        };

        const exec = (sql: string, opts?: typeof commonOpts) =>
            executeStatement(accountIdentifier, jwt, sql, opts ?? commonOpts, logger);

        switch (actionName) {
            case 'executeStatement': {
                const statement = String(inputs.statement ?? '').trim();
                if (!statement) throw new Error('statement is required.');
                const result = await exec(statement);
                return { output: { statementHandle: result.statementHandle, status: result.status, data: result.data } };
            }

            case 'getStatementStatus': {
                const statementHandle = String(inputs.statementHandle ?? '').trim();
                if (!statementHandle) throw new Error('statementHandle is required.');
                const { statusCode, data } = await snowflakeFetch(accountIdentifier, jwt, 'GET', `/statements/${statementHandle}`, undefined, logger);
                return { output: { statementHandle, status: statusCode === 200 ? 'success' : 'running', data: data?.data ?? [] } };
            }

            case 'cancelStatement': {
                const statementHandle = String(inputs.statementHandle ?? '').trim();
                if (!statementHandle) throw new Error('statementHandle is required.');
                const { data } = await snowflakeFetch(accountIdentifier, jwt, 'POST', `/statements/${statementHandle}/cancel`, {}, logger);
                return { output: { message: data?.message ?? 'Cancellation requested.' } };
            }

            case 'listDatabases': {
                const result = await exec('SHOW DATABASES', { ...commonOpts, database: undefined, schema: undefined });
                const rows = rowsToObjects(result);
                return { output: { databases: rows } };
            }

            case 'listSchemas': {
                const database = String(inputs.database ?? '').trim();
                if (!database) throw new Error('database is required.');
                const result = await exec(`SHOW SCHEMAS IN DATABASE ${database}`, { ...commonOpts, database });
                const rows = rowsToObjects(result);
                return { output: { schemas: rows } };
            }

            case 'listTables': {
                const database = String(inputs.database ?? '').trim();
                const schema = String(inputs.schema ?? '').trim();
                if (!database || !schema) throw new Error('database and schema are required.');
                const result = await exec(`SHOW TABLES IN SCHEMA ${database}.${schema}`, { ...commonOpts, database, schema });
                const rows = rowsToObjects(result);
                return { output: { tables: rows } };
            }

            case 'describeTable': {
                const database = String(inputs.database ?? '').trim();
                const schema = String(inputs.schema ?? '').trim();
                const table = String(inputs.table ?? '').trim();
                if (!database || !schema || !table) throw new Error('database, schema, and table are required.');
                const result = await exec(`DESCRIBE TABLE ${database}.${schema}.${table}`, { ...commonOpts, database, schema });
                const rows = rowsToObjects(result);
                return { output: { columns: rows } };
            }

            case 'queryTable': {
                const database = String(inputs.database ?? '').trim();
                const schema = String(inputs.schema ?? '').trim();
                const table = String(inputs.table ?? '').trim();
                if (!database || !schema || !table) throw new Error('database, schema, and table are required.');
                const limit = inputs.limit !== undefined ? Number(inputs.limit) : 100;
                const where = inputs.where ? String(inputs.where).trim() : '';
                let sql = `SELECT * FROM ${database}.${schema}.${table}`;
                if (where) sql += ` WHERE ${where}`;
                sql += ` LIMIT ${limit}`;
                const result = await exec(sql, { ...commonOpts, database, schema });
                const rows = rowsToObjects(result);
                return { output: { rows } };
            }

            case 'insertRow': {
                const database = String(inputs.database ?? '').trim();
                const schema = String(inputs.schema ?? '').trim();
                const table = String(inputs.table ?? '').trim();
                const columns = inputs.columns;
                const values = inputs.values;
                if (!database || !schema || !table) throw new Error('database, schema, and table are required.');
                if (!Array.isArray(columns) || columns.length === 0) throw new Error('columns must be a non-empty array.');
                if (!Array.isArray(values) || values.length === 0) throw new Error('values must be a non-empty array.');
                const colList = columns.map((c: string) => `"${c}"`).join(', ');
                const valList = values.map((v: any) => {
                    if (v === null || v === undefined) return 'NULL';
                    if (typeof v === 'number') return String(v);
                    return `'${String(v).replace(/'/g, "''")}'`;
                }).join(', ');
                const sql = `INSERT INTO ${database}.${schema}.${table} (${colList}) VALUES (${valList})`;
                const result = await exec(sql, { ...commonOpts, database, schema });
                return { output: { rowsAffected: result.data?.[0]?.[0] ?? 1 } };
            }

            case 'updateRows': {
                const database = String(inputs.database ?? '').trim();
                const schema = String(inputs.schema ?? '').trim();
                const table = String(inputs.table ?? '').trim();
                const setClause = String(inputs.setClause ?? '').trim();
                const whereClause = String(inputs.whereClause ?? '').trim();
                if (!database || !schema || !table) throw new Error('database, schema, and table are required.');
                if (!setClause) throw new Error('setClause is required.');
                if (!whereClause) throw new Error('whereClause is required.');
                const sql = `UPDATE ${database}.${schema}.${table} SET ${setClause} WHERE ${whereClause}`;
                const result = await exec(sql, { ...commonOpts, database, schema });
                return { output: { rowsAffected: result.data?.[0]?.[0] ?? 0 } };
            }

            case 'deleteRows': {
                const database = String(inputs.database ?? '').trim();
                const schema = String(inputs.schema ?? '').trim();
                const table = String(inputs.table ?? '').trim();
                const whereClause = String(inputs.whereClause ?? '').trim();
                if (!database || !schema || !table) throw new Error('database, schema, and table are required.');
                if (!whereClause) throw new Error('whereClause is required.');
                const sql = `DELETE FROM ${database}.${schema}.${table} WHERE ${whereClause}`;
                const result = await exec(sql, { ...commonOpts, database, schema });
                return { output: { rowsAffected: result.data?.[0]?.[0] ?? 0 } };
            }

            case 'runQuery': {
                const sql = String(inputs.sql ?? '').trim();
                if (!sql) throw new Error('sql is required.');
                const result = await exec(sql);
                const rows = rowsToObjects(result);
                return { output: { rows, rowCount: rows.length } };
            }

            default:
                return { error: `Snowflake action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Snowflake action failed.' };
    }
}
