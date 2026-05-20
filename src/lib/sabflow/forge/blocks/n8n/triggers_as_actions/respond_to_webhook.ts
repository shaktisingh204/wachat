/**
 * Forge block: Respond to Webhook (port of RespondToWebhook as a builder action)
 *
 * Source: n8n-master/packages/nodes-base/nodes/RespondToWebhook/RespondToWebhook.node.ts
 *
 * Note: n8n's runtime "respond now" response semantics don't apply here — this
 * port is for catalog parity. In n8n this node exits the workflow early and
 * sends the response back to the caller; SabFlow has no equivalent inline
 * response exit. This action just packages a response payload (status code,
 * headers, body) into a flow variable for whatever block actually wants to
 * forward it. See src/lib/sabflow/triggers/ for SabFlow's webhook handlers.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
  ForgeKeyValuePair,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';

function readHeaders(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const entry of value as ForgeKeyValuePair[]) {
    if (!entry || typeof entry !== 'object') continue;
    const key = asString(entry.key).trim();
    if (!key) continue;
    out[key] = asString(entry.value);
  }
  return out;
}

async function buildResponse(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const statusCode = asNumber(ctx.options.statusCode) ?? 200;
  if (statusCode < 100 || statusCode > 599) {
    throw new Error(`Respond to Webhook: statusCode ${statusCode} is out of range (100-599)`);
  }
  const bodyMode = asString(ctx.options.bodyMode) || 'json';
  const rawBody = asString(ctx.options.body);
  const headers = readHeaders(ctx.options.headers);

  let body: unknown = rawBody;
  let contentType = headers['Content-Type'] ?? headers['content-type'];
  if (bodyMode === 'json') {
    if (!rawBody) {
      body = null;
    } else {
      try {
        body = JSON.parse(rawBody);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Respond to Webhook: body is not valid JSON — ${message}`);
      }
    }
    if (!contentType) {
      headers['Content-Type'] = 'application/json';
      contentType = 'application/json';
    }
  } else if (bodyMode === 'text') {
    body = rawBody;
    if (!contentType) {
      headers['Content-Type'] = 'text/plain; charset=utf-8';
      contentType = 'text/plain; charset=utf-8';
    }
  } else if (bodyMode === 'noBody') {
    body = null;
  } else {
    throw new Error(`Respond to Webhook: unknown bodyMode "${bodyMode}"`);
  }

  const response = {
    statusCode,
    headers,
    body,
  };

  return {
    outputs: { response, statusCode, headers, body },
    logs: [`Respond to Webhook → packaged response ${statusCode} (${contentType ?? 'no content-type'})`],
  };
}

const BODY_MODE_OPTIONS = [
  { label: 'JSON', value: 'json' },
  { label: 'Text', value: 'text' },
  { label: 'No body', value: 'noBody' },
];

const block: ForgeBlock = {
  id: 'forge_respond_to_webhook',
  name: 'Respond to Webhook',
  description: 'Build a webhook response payload. Real inline "respond now" is part of the webhook trigger handler.',
  iconName: 'LuReply',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'build_response',
      label: 'Build response',
      description: 'Package status code, headers and body into a response object on a flow variable.',
      fields: [
        { id: 'statusCode', label: 'Status code', type: 'number', defaultValue: 200 },
        {
          id: 'bodyMode',
          label: 'Body mode',
          type: 'select',
          options: BODY_MODE_OPTIONS,
          defaultValue: 'json',
        },
        {
          id: 'body',
          label: 'Body',
          type: 'textarea',
          placeholder: '{"ok": true}',
          helperText: 'Used for JSON and Text body modes.',
        },
        {
          id: 'headers',
          label: 'Headers',
          type: 'key-value-list',
        },
      ],
      run: buildResponse,
    },
  ],
};

registerForgeBlock(block);
export default block;
