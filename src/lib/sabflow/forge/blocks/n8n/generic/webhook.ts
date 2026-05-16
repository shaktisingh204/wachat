/**
 * Forge block: Webhook (HTTP receive)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Webhook/Webhook.node.ts
 * Credential type: none — this is a primitive action, not a real trigger.
 *
 * IMPORTANT: n8n's Webhook node is a *trigger* — it starts a workflow when an
 * external HTTP call hits a registered URL. SabFlow has a dedicated trigger
 * subsystem for that, which will be wired in a later "trigger nodes" wave.
 *
 * For this wave we port Webhook as a simple "HTTP receive" action: it just
 * takes whatever the upstream block put in `ctx.options.body` (or nothing)
 * and returns a `{ status, headers, body }` envelope so flow authors can
 * model HTTP-style response shaping inline. Real trigger semantics (URL
 * registration, auth, multipart upload handling) are explicitly deferred.
 *
 * Operations covered:
 *   - respond — shape a synthetic HTTP response envelope
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
  ForgeKeyValuePair,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';

function collectHeaders(raw: unknown): Record<string, string> {
  const headers: Record<string, string> = {};
  if (Array.isArray(raw)) {
    for (const pair of raw as ForgeKeyValuePair[]) {
      if (!pair?.key) continue;
      headers[pair.key] = asString(pair.value);
    }
  }
  return headers;
}

async function respond(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const status = asNumber(ctx.options.status) ?? 200;
  const headers = collectHeaders(ctx.options.headers);
  const bodyType = asString(ctx.options.bodyType) || 'passthrough';

  let body: unknown;
  if (bodyType === 'json') {
    const raw = asString(ctx.options.jsonBody);
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch (err) {
        throw new Error(`Webhook: JSON body is not valid JSON — ${(err as Error).message}`);
      }
    } else {
      body = {};
    }
  } else if (bodyType === 'text') {
    body = asString(ctx.options.textBody);
  } else {
    // passthrough — use whatever the upstream block stored at ctx.options.body
    body = ctx.options.body ?? null;
  }

  return {
    outputs: { status, headers, body },
    logs: [`Webhook respond → ${status}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_webhook',
  name: 'Webhook',
  description:
    'Shape an HTTP-style response envelope. Real trigger semantics are wired up in the trigger-nodes wave.',
  iconName: 'LuRadioReceiver',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'respond',
      label: 'Respond',
      description: 'Build a { status, headers, body } envelope for downstream blocks.',
      fields: [
        {
          id: 'status',
          label: 'Status code',
          type: 'number',
          defaultValue: 200,
        },
        {
          id: 'headers',
          label: 'Response headers',
          type: 'key-value-list',
        },
        {
          id: 'bodyType',
          label: 'Body type',
          type: 'select',
          defaultValue: 'passthrough',
          options: [
            { label: 'Pass through (use `body` variable)', value: 'passthrough' },
            { label: 'JSON', value: 'json' },
            { label: 'Raw text', value: 'text' },
          ],
        },
        {
          id: 'jsonBody',
          label: 'JSON body',
          type: 'json',
          placeholder: '{ "ok": true }',
          showIf: { field: 'bodyType', equals: 'json' },
        },
        {
          id: 'textBody',
          label: 'Body',
          type: 'textarea',
          showIf: { field: 'bodyType', equals: 'text' },
        },
      ],
      run: respond,
    },
  ],
};

registerForgeBlock(block);
export default block;
