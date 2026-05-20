/**
 * Forge block: PostHog
 *
 * Source: n8n-master/packages/nodes-base/nodes/PostHog/PostHog.node.ts
 * Credential type: 'posthog' — { baseUrl, apiKey, personalApiKey }.
 *   `apiKey` (project key) is sent inside the JSON body as `api_key`.
 *   `personalApiKey` is sent as `Authorization: Bearer <key>` for management
 *   endpoints (feature-flag decide).
 *
 * Operations covered:
 *   - event.capture
 *   - person.identify
 *   - alias.create        (link an anonymous distinct_id to a known one)
 *   - track.page          (send a $pageview / $screen event)
 *   - featureFlag.check (decide)
 *
 * Out of scope (deferred):
 *   - cohort / annotation: those live behind the personalApiKey-only
 *     management API and require list-style pagination which adds noise to
 *     the trigger-only flows that consume this block today.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function getCred(ctx: ForgeActionContext): { baseUrl: string; apiKey: string; personalApiKey: string } {
  const cred = requireCredential('PostHog', ctx.credential);
  const baseUrl = (cred.baseUrl ?? 'https://app.posthog.com').replace(/\/$/, '');
  const apiKey = cred.apiKey ?? '';
  const personalApiKey = cred.personalApiKey ?? '';
  if (!apiKey) throw new Error('PostHog: credential is missing `apiKey`');
  return { baseUrl, apiKey, personalApiKey };
}

function tryJson(s: string): Record<string, unknown> | undefined {
  if (!s) return undefined;
  try {
    const v = JSON.parse(s);
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : undefined;
  } catch {
    throw new Error('PostHog: properties must be valid JSON');
  }
}

// ── Actions ────────────────────────────────────────────────────────────────

async function eventCapture(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { baseUrl, apiKey } = getCred(ctx);
  const eventName = asString(ctx.options.eventName);
  const distinctId = asString(ctx.options.distinctId);
  if (!eventName) throw new Error('PostHog: eventName is required');
  if (!distinctId) throw new Error('PostHog: distinctId is required');
  const properties = tryJson(asString(ctx.options.properties)) ?? {};
  const body = {
    api_key: apiKey,
    event: eventName,
    distinct_id: distinctId,
    properties,
    timestamp: new Date().toISOString(),
  };
  const res = await apiRequest({
    service: 'PostHog',
    method: 'POST',
    url: `${baseUrl}/capture/`,
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`PostHog event capture → ${eventName}`] };
}

async function personIdentify(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { baseUrl, apiKey } = getCred(ctx);
  const distinctId = asString(ctx.options.distinctId);
  if (!distinctId) throw new Error('PostHog: distinctId is required');
  const properties = tryJson(asString(ctx.options.properties)) ?? {};
  const body = {
    api_key: apiKey,
    event: '$identify',
    distinct_id: distinctId,
    $set: properties,
    timestamp: new Date().toISOString(),
  };
  const res = await apiRequest({
    service: 'PostHog',
    method: 'POST',
    url: `${baseUrl}/capture/`,
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`PostHog person identify → ${distinctId}`] };
}

async function aliasCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { baseUrl, apiKey } = getCred(ctx);
  const distinctId = asString(ctx.options.distinctId);
  const alias = asString(ctx.options.alias);
  if (!distinctId) throw new Error('PostHog: distinctId is required');
  if (!alias) throw new Error('PostHog: alias is required');
  // n8n posts to /batch with a single `$create_alias` event — mirror that
  // shape so the PostHog batch processor recognises the event.
  const body = {
    api_key: apiKey,
    type: 'alias',
    event: '$create_alias',
    properties: { distinct_id: distinctId, alias },
    timestamp: new Date().toISOString(),
  };
  const res = await apiRequest({
    service: 'PostHog',
    method: 'POST',
    url: `${baseUrl}/batch/`,
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`PostHog alias create → ${alias} = ${distinctId}`] };
}

async function trackPage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { baseUrl, apiKey } = getCred(ctx);
  const distinctId = asString(ctx.options.distinctId);
  const name = asString(ctx.options.name);
  const kind = (asString(ctx.options.kind) || 'page') as 'page' | 'screen';
  if (!distinctId) throw new Error('PostHog: distinctId is required');
  if (!name) throw new Error('PostHog: name is required');
  const properties = tryJson(asString(ctx.options.properties)) ?? {};
  const body = {
    api_key: apiKey,
    name,
    type: kind,
    event: `$${kind}`,
    distinct_id: distinctId,
    properties,
    timestamp: new Date().toISOString(),
  };
  const res = await apiRequest({
    service: 'PostHog',
    method: 'POST',
    url: `${baseUrl}/batch/`,
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`PostHog track ${kind} → ${name}`] };
}

async function featureFlagCheck(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { baseUrl, apiKey } = getCred(ctx);
  const distinctId = asString(ctx.options.distinctId);
  if (!distinctId) throw new Error('PostHog: distinctId is required');
  const res = await apiRequest({
    service: 'PostHog',
    method: 'POST',
    url: `${baseUrl}/decide/?v=3`,
    json: { api_key: apiKey, distinct_id: distinctId },
  });
  return { outputs: { result: res.data }, logs: [`PostHog feature-flag check → ${distinctId}`] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_posthog',
  name: 'PostHog',
  description: 'Capture events, identify people and check feature flags in PostHog.',
  iconName: 'LuChartLine',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'posthog',
  },
  actions: [
    {
      id: 'event_capture',
      label: 'Capture event',
      description: 'Send a custom event to PostHog.',
      fields: [
        { id: 'eventName', label: 'Event name', type: 'text', required: true },
        { id: 'distinctId', label: 'Distinct ID', type: 'text', required: true },
        { id: 'properties', label: 'Properties (JSON)', type: 'json' },
      ],
      run: eventCapture,
    },
    {
      id: 'person_identify',
      label: 'Identify person',
      description: 'Set user properties on a person.',
      fields: [
        { id: 'distinctId', label: 'Distinct ID', type: 'text', required: true },
        { id: 'properties', label: 'Properties (JSON)', type: 'json' },
      ],
      run: personIdentify,
    },
    {
      id: 'alias_create',
      label: 'Create alias',
      description: 'Link an anonymous distinct id to a known one.',
      fields: [
        { id: 'distinctId', label: 'Distinct ID', type: 'text', required: true },
        { id: 'alias', label: 'Alias', type: 'text', required: true },
      ],
      run: aliasCreate,
    },
    {
      id: 'track_page',
      label: 'Track page / screen',
      description: 'Send a $pageview (web) or $screen (mobile) event.',
      fields: [
        { id: 'distinctId', label: 'Distinct ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text', required: true },
        {
          id: 'kind',
          label: 'Kind',
          type: 'select',
          defaultValue: 'page',
          options: [
            { label: 'Page (web)', value: 'page' },
            { label: 'Screen (mobile)', value: 'screen' },
          ],
        },
        { id: 'properties', label: 'Properties (JSON)', type: 'json' },
      ],
      run: trackPage,
    },
    {
      id: 'feature_flag_check',
      label: 'Check feature flags',
      description: 'Evaluate all feature flags for a distinct id.',
      fields: [
        { id: 'distinctId', label: 'Distinct ID', type: 'text', required: true },
      ],
      run: featureFlagCheck,
    },
  ],
};

registerForgeBlock(block);
export default block;
