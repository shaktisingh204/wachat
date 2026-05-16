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
 *   - featureFlag.check (decide)
 *
 * Out of scope (deferred):
 *   - cohort / annotation / alias batching
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
