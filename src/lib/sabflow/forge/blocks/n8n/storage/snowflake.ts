/**
 * Forge block: Snowflake
 *
 * Source: n8n-master/packages/nodes-base/nodes/Snowflake/Snowflake.node.ts
 * Credential type: 'snowflake' (expects { account, username, password, database?, warehouse?, schema? }).
 *
 * Implementation:
 *   The n8n node uses the `snowflake-sdk` package; this repo does not bundle
 *   that driver. Instead we call Snowflake's REST SQL API at
 *   https://<account>.snowflakecomputing.com/api/v2/statements/, which expects
 *   a JWT or OAuth bearer token. For the first port we accept either:
 *     1. A pre-issued bearer token in the `password` credential field
 *        (recommended: generate one via the Snowflake UI / SnowSQL `KEYPAIR`
 *        auth helper).
 *     2. An "OAuth" credential value the platform admin pre-stores.
 *
 *   This is enough for the three core query operations. Full driver-based
 *   binding (`snowflake-sdk`) lands in a follow-up wave alongside the n8n MySQL
 *   / Postgres native drivers.
 *
 * Operations covered:
 *   - query.execute   POST /api/v2/statements   (raw SQL)
 *   - query.insert    INSERT INTO <table> (cols) VALUES (?)   with bindings
 *   - query.update    UPDATE <table> SET ...   WHERE ...      with bindings
 *
 * Deferred:
 *   - Result-set pagination (the API returns the first page only here)
 *   - Streaming results, MERGE, COPY INTO, stages
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function snowflakeUrl(ctx: ForgeActionContext): string {
  const cred = requireCredential('Snowflake', ctx.credential);
  if (!cred.account) throw new Error('Snowflake: credential is missing `account`');
  // Accounts shaped like "xy12345.us-east-1" become "xy12345.us-east-1.snowflakecomputing.com".
  return `https://${cred.account}.snowflakecomputing.com/api/v2/statements`;
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Snowflake', ctx.credential);
  // We treat the `password` field as the bearer token. The credential field's
  // schema labels it "Password" but for REST SQL API we expect a JWT or OAuth
  // access token. This is documented in the block description.
  const token = cred.password;
  if (!token) throw new Error('Snowflake: paste a JWT / OAuth bearer token into the credential password field');
  return {
    Authorization: `Bearer ${token}`,
    'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT',
    Accept: 'application/json',
  };
}

type SnowflakeRequest = {
  statement: string;
  database?: string;
  warehouse?: string;
  schema?: string;
  bindings?: Record<string, { type: string; value: string }>;
  timeout?: number;
};

async function runSql(ctx: ForgeActionContext, body: SnowflakeRequest): Promise<unknown> {
  const cred = requireCredential('Snowflake', ctx.credential);
  const payload: SnowflakeRequest = {
    statement: body.statement,
    database: body.database ?? cred.database ?? undefined,
    warehouse: body.warehouse ?? cred.warehouse ?? undefined,
    schema: body.schema ?? cred.schema ?? undefined,
    bindings: body.bindings,
    timeout: body.timeout ?? 60,
  };
  const res = await apiRequest({
    service: 'Snowflake',
    method: 'POST',
    url: snowflakeUrl(ctx),
    headers: authHeaders(ctx),
    json: payload,
  });
  return res.data;
}

function bindingsFromJson(raw: unknown, field: string): Record<string, { type: string; value: string }> {
  const s = asString(raw).trim();
  if (!s) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch (err) {
    throw new Error(`Snowflake: ${field} is not valid JSON — ${(err as Error).message}`);
  }
  // Accept either an object of { "1": "value", "2": 42 } or an array.
  const out: Record<string, { type: string; value: string }> = {};
  if (Array.isArray(parsed)) {
    parsed.forEach((v, i) => {
      out[String(i + 1)] = { type: typeof v === 'number' ? 'FIXED' : 'TEXT', value: String(v) };
    });
    return out;
  }
  if (parsed && typeof parsed === 'object') {
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      out[k] = { type: typeof v === 'number' ? 'FIXED' : 'TEXT', value: String(v) };
    }
    return out;
  }
  throw new Error(`Snowflake: ${field} must be a JSON object or array`);
}

async function queryExecute(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sql = asString(ctx.options.sql);
  if (!sql) throw new Error('Snowflake: sql is required');
  const data = await runSql(ctx, {
    statement: sql,
    bindings: bindingsFromJson(ctx.options.bindings, 'bindings'),
  });
  return { outputs: { result: data }, logs: [`Snowflake execute → ${sql.slice(0, 60)}…`] };
}

async function queryInsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const table = asString(ctx.options.table);
  const columns = asString(ctx.options.columns);
  const values = asString(ctx.options.values); // JSON array of arrays — caller-supplied
  if (!table) throw new Error('Snowflake: table is required');
  if (!columns) throw new Error('Snowflake: columns is required');
  if (!values) throw new Error('Snowflake: values is required');

  let valuesParsed: unknown;
  try {
    valuesParsed = JSON.parse(values);
  } catch (err) {
    throw new Error(`Snowflake: values is not valid JSON — ${(err as Error).message}`);
  }
  if (!Array.isArray(valuesParsed) || valuesParsed.length === 0) {
    throw new Error('Snowflake: values must be a non-empty JSON array');
  }
  const colsList = columns.split(',').map((c) => c.trim()).filter(Boolean);
  const placeholders = colsList.map((_, i) => `:${i + 1}`).join(', ');
  const statement = `INSERT INTO ${table} (${colsList.join(', ')}) VALUES (${placeholders})`;
  const bindings: Record<string, { type: string; value: string }> = {};
  const row = (valuesParsed as unknown[][])[0];
  if (!Array.isArray(row)) throw new Error('Snowflake: values must be an array of rows (array of arrays)');
  row.forEach((v, i) => {
    bindings[String(i + 1)] = { type: typeof v === 'number' ? 'FIXED' : 'TEXT', value: String(v) };
  });

  const data = await runSql(ctx, { statement, bindings });
  return { outputs: { result: data }, logs: [`Snowflake insert → ${table}`] };
}

async function queryUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sql = asString(ctx.options.sql);
  if (!sql) throw new Error('Snowflake: sql is required (e.g. UPDATE t SET x = :1 WHERE id = :2)');
  const data = await runSql(ctx, {
    statement: sql,
    bindings: bindingsFromJson(ctx.options.bindings, 'bindings'),
  });
  return { outputs: { result: data }, logs: [`Snowflake update → ${sql.slice(0, 60)}…`] };
}

const block: ForgeBlock = {
  id: 'forge_snowflake',
  name: 'Snowflake',
  description: 'Run SQL against Snowflake via the REST SQL API (paste a JWT in the password field).',
  iconName: 'LuSnowflake',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'snowflake' },
  actions: [
    {
      id: 'query_execute',
      label: 'Execute SQL',
      description: 'Run an arbitrary SQL statement with optional bindings.',
      fields: [
        { id: 'sql', label: 'SQL', type: 'textarea', required: true, placeholder: 'SELECT * FROM users WHERE id = :1' },
        {
          id: 'bindings',
          label: 'Bindings (JSON)',
          type: 'json',
          defaultValue: '{}',
          helperText: 'Map of position → value, e.g. {"1": "42"}',
        },
      ],
      run: queryExecute,
    },
    {
      id: 'query_insert',
      label: 'Insert row',
      description: 'Parameterised INSERT — supply a comma-separated column list and a JSON values array.',
      fields: [
        { id: 'table', label: 'Table', type: 'text', required: true },
        { id: 'columns', label: 'Columns (CSV)', type: 'text', required: true, placeholder: 'name, email' },
        {
          id: 'values',
          label: 'Values (JSON array of arrays)',
          type: 'json',
          required: true,
          placeholder: '[["Ada", "ada@example.com"]]',
        },
      ],
      run: queryInsert,
    },
    {
      id: 'query_update',
      label: 'Update rows',
      description: 'Parameterised UPDATE — write the full UPDATE statement with :N placeholders.',
      fields: [
        {
          id: 'sql',
          label: 'SQL',
          type: 'textarea',
          required: true,
          placeholder: 'UPDATE users SET name = :1 WHERE id = :2',
        },
        { id: 'bindings', label: 'Bindings (JSON)', type: 'json', defaultValue: '{}' },
      ],
      run: queryUpdate,
    },
  ],
};

registerForgeBlock(block);
export default block;
