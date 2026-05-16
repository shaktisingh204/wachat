/**
 * Forge block: SeaTable Trigger (info shim).
 *
 * n8n's SeaTable trigger is a polling node (it does not register a webhook
 * upstream — it periodically queries SeaTable for new/updated rows or
 * signatures). This shim returns the polling metadata + the SabFlow webhook
 * URL so a flow author can either:
 *   - Configure SeaTable's automation rules to call the SabFlow URL, OR
 *   - Drive a SabFlow Cron block that calls SeaTable's API on a schedule.
 *
 * Source: n8n-master/packages/nodes-base/nodes/SeaTable/SeaTableTrigger.node.ts
 *         (delegates to v1 + v2 — v2 is the current default)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = [
  'newRow',
  'updatedRow',
  'newAsset', // = new signature
] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const event = asString(ctx.options.event) || 'newRow';
  const tableName = asString(ctx.options.tableName);
  const viewName = asString(ctx.options.viewName);

  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';

  return {
    outputs: {
      service: 'SeaTable',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selected: { event, tableName, viewName },
      registrationDocs: 'https://seatable.io/docs/automation/automation-rules/',
      registrationInstructions: [
        'SeaTable\'s n8n trigger is polling-based — there is no upstream subscription URL.',
        '1. Recommended: in SeaTable, open the base → Automations → "Add Rule". Choose a trigger ("Record added", "Record modified", or "Signature received") and an action "Send notification to URL" with the SabFlow receiver URL: ' +
          sabflowReceiverUrl,
        `2. Or, drive a SabFlow Cron block that calls https://cloud.seatable.io/dtable-server/api/v1/dtables/<dtable_uuid>/rows/?table_name=${tableName || '<table>'}${viewName ? `&view_name=${viewName}` : ''} on a schedule and dedupes by row id / mtime.`,
        `3. Selected event "${event}" maps to: newRow → poll by ctime; updatedRow → poll by mtime; newAsset → poll the signature columns.`,
      ].join('\n'),
    },
    logs: [`SeaTable trigger info → event=${event} table=${tableName || '<unset>'}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_seatable_trigger',
  name: 'SeaTable Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + the SeaTable polling metadata (event, table, view) n8n uses. Wire SeaTable\'s automation rules to the URL or drive a SabFlow Cron block.',
  iconName: 'LuTable',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description:
        'Return the SabFlow receiver URL + the SeaTable event/table/view metadata for wiring a polling or automation rule.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'event',
          label: 'Event',
          type: 'select',
          options: KNOWN_EVENTS.map((v) => ({ label: v, value: v })),
          helperText: 'newRow, updatedRow, or newAsset (signature).',
        },
        {
          id: 'tableName',
          label: 'Table name',
          type: 'text',
          placeholder: 'e.g. Orders',
        },
        {
          id: 'viewName',
          label: 'View name',
          type: 'text',
          placeholder: 'e.g. Default View',
          helperText: 'Only used for newRow / updatedRow.',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
