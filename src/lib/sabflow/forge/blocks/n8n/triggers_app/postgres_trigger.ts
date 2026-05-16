/**
 * Forge block: Postgres Trigger (info shim).
 *
 * This is a registration-info shim. Unlike webhook triggers, Postgres' trigger
 * is connection-based — n8n opens a `LISTEN <channel>` against the DB and emits
 * on NOTIFY. SabFlow doesn't yet maintain long-lived DB listeners, so this shim
 * returns the registration metadata (channel name, trigger SQL, etc.) so the
 * flow author can either:
 *   1) Wire a Postgres TRIGGER + FUNCTION manually that POSTs to the SabFlow
 *      webhook receiver via pg_net / HTTP extension, OR
 *   2) Run a periodic polling block (cron) that SELECTs rows since last check.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Postgres/PostgresTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const TRIGGER_MODES = ['createTrigger', 'listenTrigger'] as const;
const FIRES_ON = ['INSERT', 'UPDATE', 'DELETE'] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const triggerMode = asString(ctx.options.triggerMode) || 'createTrigger';
  const schema = asString(ctx.options.schema) || 'public';
  const tableName = asString(ctx.options.tableName);
  const firesOn = asString(ctx.options.firesOn) || 'INSERT';
  const channelName = asString(ctx.options.channelName);

  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';

  return {
    outputs: {
      service: 'Postgres',
      sabflowReceiverUrl,
      supportedTriggerModes: TRIGGER_MODES,
      supportedFiresOn: FIRES_ON,
      selected: { triggerMode, schema, tableName, firesOn, channelName },
      registrationDocs:
        'https://www.postgresql.org/docs/current/sql-createtrigger.html',
      registrationInstructions: [
        'Postgres has no upstream "subscribe URL" API — the trigger is enforced inside the database.',
        triggerMode === 'listenTrigger'
          ? `1. Open a psql session and run: LISTEN ${channelName || '<channel>'};`
          : `1. CREATE OR REPLACE FUNCTION on ${schema}.${tableName || '<table>'} that NOTIFY ${channelName || '<channel>'}, row_to_json(NEW)::text; CREATE TRIGGER … AFTER ${firesOn} … EXECUTE FUNCTION …;`,
        '2. Install pg_net (Supabase) or http extension and have the trigger function POST the row to: ' + sabflowReceiverUrl,
        '   …or run a SabFlow Cron block that polls the table for new rows since last execution.',
      ].join('\n'),
    },
    logs: [
      `Postgres trigger info → mode=${triggerMode} firesOn=${firesOn} table=${schema}.${tableName || '<table>'}`,
    ],
  };
}

const block: ForgeBlock = {
  id: 'forge_postgres_trigger',
  name: 'Postgres Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + the SQL a flow author needs to wire a Postgres trigger or LISTEN channel. SabFlow itself does not hold a persistent LISTEN connection.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description:
        'Return the SabFlow receiver URL + the Postgres trigger metadata (mode, schema, table, channel) so you can wire a NOTIFY-to-HTTP bridge or a polling block.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'triggerMode',
          label: 'Trigger mode',
          type: 'select',
          options: TRIGGER_MODES.map((v) => ({ label: v, value: v })),
          helperText:
            'createTrigger → SabFlow gives you SQL to CREATE TRIGGER + FUNCTION. listenTrigger → just listen on an existing channel.',
        },
        {
          id: 'schema',
          label: 'Schema',
          type: 'text',
          placeholder: 'public',
        },
        {
          id: 'tableName',
          label: 'Table name',
          type: 'text',
          placeholder: 'e.g. orders',
        },
        {
          id: 'firesOn',
          label: 'Fires on',
          type: 'select',
          options: FIRES_ON.map((v) => ({ label: v, value: v })),
          helperText: 'INSERT, UPDATE, or DELETE (only used when triggerMode=createTrigger).',
        },
        {
          id: 'channelName',
          label: 'Channel name',
          type: 'text',
          placeholder: 'e.g. sabflow_orders',
          helperText: 'Postgres NOTIFY channel to listen on / emit to.',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
