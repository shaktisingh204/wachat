/**
 * Forge block: Segment
 *
 * Source: n8n-master/packages/nodes-base/nodes/Segment/Segment.node.ts
 * Credential type: 'segment' — { writeKey }; sent as HTTP Basic with empty
 *   password (`<writeKey>:`).
 *
 * Operations covered (all four n8n resources + alias):
 *   - identify           POST /identify   (n8n: identify.create)
 *   - track              POST /track      (n8n: track.event)
 *   - page               POST /page       (n8n: track.page)
 *   - group              POST /group      (n8n: group.add)
 *   - alias              POST /alias      (extra; not in n8n's node)
 *
 * Note on n8n parity: n8n's UI bundles `context.{app,campaign,device,...}`
 * and `integrations.{all,salesforce}` as fixedCollection sub-forms; SabFlow
 * accepts the same shape inline via the `traits`/`properties` JSON fields
 * (Segment's HTTP API merges everything under the same envelope).
 *
 * Out of scope (deferred):
 *   - batch payloads (Segment's `/batch` endpoint)
 *   - the Segment v2 Public API (this is the tracking ingestion API)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.segment.io/v1';

function basicHeader(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Segment', ctx.credential);
  const key = cred.writeKey ?? '';
  if (!key) throw new Error('Segment: credential is missing `writeKey`');
  const raw = `${key}:`;
  let encoded: string;
  if (typeof btoa === 'function') {
    encoded = btoa(raw);
  } else {
    const B = (globalThis as { Buffer?: { from: (s: string) => { toString: (e: string) => string } } }).Buffer;
    if (!B) throw new Error('Segment: no base64 encoder available in runtime');
    encoded = B.from(raw).toString('base64');
  }
  return { Authorization: `Basic ${encoded}` };
}

async function post(ctx: ForgeActionContext, path: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await apiRequest({
    service: 'Segment',
    method: 'POST',
    url: `${BASE}${path}`,
    headers: basicHeader(ctx),
    json: body,
  });
  return res.data;
}

function tryJson(s: string, field: string): Record<string, unknown> | undefined {
  if (!s) return undefined;
  try {
    const v = JSON.parse(s);
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : undefined;
  } catch {
    throw new Error(`Segment: ${field} must be valid JSON`);
  }
}

function whoBody(ctx: ForgeActionContext): { userId?: string; anonymousId?: string } {
  const userId = asString(ctx.options.userId);
  const anonymousId = asString(ctx.options.anonymousId);
  if (!userId && !anonymousId) {
    throw new Error('Segment: userId or anonymousId is required');
  }
  const out: { userId?: string; anonymousId?: string } = {};
  if (userId) out.userId = userId;
  if (anonymousId) out.anonymousId = anonymousId;
  return out;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function identify(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const body: Record<string, unknown> = {
    ...whoBody(ctx),
    traits: tryJson(asString(ctx.options.traits), 'traits') ?? {},
  };
  const data = await post(ctx, '/identify', body);
  return { outputs: { result: data }, logs: ['Segment identify'] };
}

async function track(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const event = asString(ctx.options.event);
  if (!event) throw new Error('Segment: event is required');
  const body: Record<string, unknown> = {
    ...whoBody(ctx),
    event,
    properties: tryJson(asString(ctx.options.properties), 'properties') ?? {},
  };
  const data = await post(ctx, '/track', body);
  return { outputs: { result: data }, logs: [`Segment track → ${event}`] };
}

async function page(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  const body: Record<string, unknown> = {
    ...whoBody(ctx),
    name: name || undefined,
    properties: tryJson(asString(ctx.options.properties), 'properties') ?? {},
  };
  const data = await post(ctx, '/page', body);
  return { outputs: { result: data }, logs: [`Segment page → ${name || 'unnamed'}`] };
}

async function group(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const groupId = asString(ctx.options.groupId);
  if (!groupId) throw new Error('Segment: groupId is required');
  const body: Record<string, unknown> = {
    ...whoBody(ctx),
    groupId,
    traits: tryJson(asString(ctx.options.traits), 'traits') ?? {},
  };
  const data = await post(ctx, '/group', body);
  return { outputs: { result: data }, logs: [`Segment group → ${groupId}`] };
}

async function alias(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const previousId = asString(ctx.options.previousId);
  const userId = asString(ctx.options.userId);
  if (!previousId) throw new Error('Segment: previousId is required');
  if (!userId) throw new Error('Segment: userId is required');
  const data = await post(ctx, '/alias', { previousId, userId });
  return { outputs: { result: data }, logs: [`Segment alias → ${previousId} → ${userId}`] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_segment',
  name: 'Segment',
  description: 'Send identify, track, page, group and alias calls to Segment.',
  iconName: 'LuChartScatter',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'segment',
  },
  actions: [
    {
      id: 'identify',
      label: 'Identify',
      description: 'Tie a user to traits.',
      fields: [
        { id: 'userId', label: 'User ID', type: 'text' },
        { id: 'anonymousId', label: 'Anonymous ID', type: 'text' },
        { id: 'traits', label: 'Traits (JSON)', type: 'json' },
      ],
      run: identify,
    },
    {
      id: 'track',
      label: 'Track event',
      description: 'Record an event performed by a user.',
      fields: [
        { id: 'event', label: 'Event', type: 'text', required: true },
        { id: 'userId', label: 'User ID', type: 'text' },
        { id: 'anonymousId', label: 'Anonymous ID', type: 'text' },
        { id: 'properties', label: 'Properties (JSON)', type: 'json' },
      ],
      run: track,
    },
    {
      id: 'page',
      label: 'Page view',
      description: 'Record a page view.',
      fields: [
        { id: 'name', label: 'Page name', type: 'text' },
        { id: 'userId', label: 'User ID', type: 'text' },
        { id: 'anonymousId', label: 'Anonymous ID', type: 'text' },
        { id: 'properties', label: 'Properties (JSON)', type: 'json' },
      ],
      run: page,
    },
    {
      id: 'group',
      label: 'Group',
      description: 'Associate a user with a group.',
      fields: [
        { id: 'groupId', label: 'Group ID', type: 'text', required: true },
        { id: 'userId', label: 'User ID', type: 'text' },
        { id: 'anonymousId', label: 'Anonymous ID', type: 'text' },
        { id: 'traits', label: 'Traits (JSON)', type: 'json' },
      ],
      run: group,
    },
    {
      id: 'alias',
      label: 'Alias',
      description: 'Merge two user identities.',
      fields: [
        { id: 'previousId', label: 'Previous ID', type: 'text', required: true },
        { id: 'userId', label: 'User ID', type: 'text', required: true },
      ],
      run: alias,
    },
  ],
};

registerForgeBlock(block);
export default block;
