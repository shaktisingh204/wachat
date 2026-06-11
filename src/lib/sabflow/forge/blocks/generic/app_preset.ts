/**
 * Forge block: App preset (Tier 2 of the 1,000-apps plan).
 *
 * A single dispatch block that executes any preset JSON definition from
 * `src/lib/sabflow/app-presets/<id>.json`. The plan and engine sketch live in
 * `SABFLOW_1000_APPS_PLAN.md` §6.
 *
 * `block.options` shape:
 *   { presetId: string, actionId: string, inputs: Record<string, unknown> }
 *
 * The credential surface is intentionally generic — at runtime we use
 * `preset.auth.credentialType` to resolve the right credential record (the
 * caller / engine fetches that into `ctx.credential`). Authorization headers
 * are then assembled by `buildAuthHeaders` based on `auth.type`.
 */

import { registerForgeBlock } from '../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../types';
import { apiRequest, asString } from '../n8n/_shared/http';

import {
  appendQuery,
  buildAuthHeaders,
  buildAuthQuery,
  coerceJsonInputs,
  findMissingRequiredFields,
  projectOutput,
  resolvePath,
} from '@/lib/sabflow/app-presets/runtime/exec';
import { loadPreset } from '@/lib/sabflow/app-presets/runtime/loader';

async function execute(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const presetId = asString(ctx.options.presetId);
  const actionId = asString(ctx.options.actionId);
  if (!presetId) throw new Error('App preset: presetId is required');
  if (!actionId) throw new Error('App preset: actionId is required');

  const preset = await loadPreset(presetId);
  if (!preset) throw new Error(`App preset: '${presetId}' not found`);
  const endpoint = preset.endpoints.find((e) => e.id === actionId);
  if (!endpoint) {
    throw new Error(`App preset '${presetId}': action '${actionId}' not found`);
  }

  const rawInputsValue = ctx.options.inputs;
  let inputs: Record<string, unknown> = {};
  if (rawInputsValue && typeof rawInputsValue === 'object' && !Array.isArray(rawInputsValue)) {
    inputs = rawInputsValue as Record<string, unknown>;
  } else if (typeof rawInputsValue === 'string' && rawInputsValue.trim()) {
    try {
      const parsed = JSON.parse(rawInputsValue);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        inputs = parsed as Record<string, unknown>;
      }
    } catch (err) {
      throw new Error(
        `App preset '${presetId}': inputs must be a JSON object — ${(err as Error).message}`,
      );
    }
  }

  // Parse string values for `json`-typed fields into structured values so
  // they reach the body as objects/arrays (a clear error names the field).
  try {
    inputs = coerceJsonInputs(endpoint.fields, inputs);
  } catch (err) {
    throw new Error(`${preset.name}.${endpoint.id}: ${(err as Error).message}`);
  }

  // Validate required fields (post-interpolation) before touching the network.
  const missing = findMissingRequiredFields(endpoint.fields, inputs);
  if (missing.length > 0) {
    throw new Error(
      `${preset.name}.${endpoint.id}: missing required field${missing.length === 1 ? '' : 's'}: ${missing
        .map((f) => f.label)
        .join(', ')}`,
    );
  }

  const resolved = resolvePath(
    preset.baseUrl + endpoint.path,
    endpoint.fields,
    inputs,
    endpoint,
    preset.auth,
  );

  const authHeaders = buildAuthHeaders(preset.auth, ctx.credential);
  const authQuery = buildAuthQuery(preset.auth, ctx.credential);
  const finalUrl = appendQuery(resolved.url, { ...resolved.query, ...authQuery });

  const writeMethod =
    endpoint.method === 'POST' || endpoint.method === 'PATCH' || endpoint.method === 'PUT';

  const res = await apiRequest({
    service: preset.name,
    method: endpoint.method,
    url: finalUrl,
    headers: { ...resolved.headers, ...authHeaders },
    json: writeMethod ? resolved.body ?? {} : undefined,
    throwOnError: false,
  });

  if (!res.ok) {
    const clip = res.text.length > 300 ? `${res.text.slice(0, 300)}…` : res.text;
    throw new Error(
      `${preset.name}.${endpoint.id} failed (${res.status}): ${clip}`,
    );
  }

  return {
    outputs: {
      data: projectOutput(res.data, endpoint.outputPath),
      status: res.status,
      ok: res.ok,
    },
    logs: [`${preset.name}.${endpoint.id} → ${res.status}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_app_preset',
  name: 'App preset',
  description: 'Generic adapter that executes any app-preset JSON definition (1,000+ apps).',
  iconName: 'LuPackage',
  category: 'Integration',
  // Default credential surface — the dispatcher uses `preset.auth.credentialType`
  // at run time via `ctx.credential`, so this is a placeholder for the UI.
  auth: { type: 'apiKey', credentialType: 'http_header_auth' },
  actions: [
    {
      id: 'execute',
      label: 'Execute preset',
      description: 'Run an endpoint from a preset JSON.',
      fields: [
        { id: 'presetId', label: 'Preset ID', type: 'text', required: true },
        { id: 'actionId', label: 'Action ID', type: 'text', required: true },
        { id: 'inputs', label: 'Inputs (JSON)', type: 'json' },
      ],
      run: execute,
    },
  ],
};

registerForgeBlock(block);
export default block;
