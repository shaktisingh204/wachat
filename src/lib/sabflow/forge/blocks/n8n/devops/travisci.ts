/**
 * Forge block: Travis CI
 *
 * Source: n8n-master/packages/nodes-base/nodes/TravisCi/TravisCi.node.ts
 * Credential type: 'travisci' (expects { apiToken, baseUrl? }).
 *
 * Operations covered (Travis CI v3 API):
 *   - build.list     GET    /repo/{slug}/builds
 *   - build.get      GET    /build/{id}
 *   - build.restart  POST   /build/{id}/restart
 *   - build.cancel   POST   /build/{id}/cancel
 *
 * Deferred:
 *   - job-level operations, settings, env-vars
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const DEFAULT_BASE = 'https://api.travis-ci.com';

function travisConn(ctx: ForgeActionContext): { base: string; headers: Record<string, string> } {
  const cred = requireCredential('Travis CI', ctx.credential);
  const apiToken = cred.apiToken;
  if (!apiToken) throw new Error('Travis CI: credential is missing `apiToken`');
  const base = (cred.baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  return {
    base,
    headers: {
      Authorization: `token ${apiToken}`,
      'Travis-API-Version': '3',
    },
  };
}

async function buildList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const slug = asString(ctx.options.slug);
  if (!slug) throw new Error('Travis CI: slug is required (e.g. owner/repo)');

  const { base, headers } = travisConn(ctx);
  const params = new URLSearchParams();
  const limit = asString(ctx.options.limit);
  if (limit) params.set('limit', limit);
  const qs = params.toString();

  const res = await apiRequest({
    service: 'Travis CI',
    method: 'GET',
    url: `${base}/repo/${encodeURIComponent(slug)}/builds${qs ? `?${qs}` : ''}`,
    headers,
  });

  const body = res.data as { builds?: unknown[] };
  const builds = Array.isArray(body?.builds) ? body.builds : [];
  return {
    outputs: { builds, count: builds.length },
    logs: [`Travis CI build list → ${slug} (${builds.length})`],
  };
}

async function buildGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const buildId = asString(ctx.options.buildId);
  if (!buildId) throw new Error('Travis CI: buildId is required');
  const { base, headers } = travisConn(ctx);
  const res = await apiRequest({
    service: 'Travis CI',
    method: 'GET',
    url: `${base}/build/${encodeURIComponent(buildId)}`,
    headers,
  });
  return {
    outputs: { build: res.data },
    logs: [`Travis CI build get → ${buildId}`],
  };
}

async function buildRestart(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const buildId = asString(ctx.options.buildId);
  if (!buildId) throw new Error('Travis CI: buildId is required');
  const { base, headers } = travisConn(ctx);
  const res = await apiRequest({
    service: 'Travis CI',
    method: 'POST',
    url: `${base}/build/${encodeURIComponent(buildId)}/restart`,
    headers,
  });
  return {
    outputs: { result: res.data },
    logs: [`Travis CI build restart → ${buildId}`],
  };
}

async function buildCancel(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const buildId = asString(ctx.options.buildId);
  if (!buildId) throw new Error('Travis CI: buildId is required');
  const { base, headers } = travisConn(ctx);
  const res = await apiRequest({
    service: 'Travis CI',
    method: 'POST',
    url: `${base}/build/${encodeURIComponent(buildId)}/cancel`,
    headers,
  });
  return {
    outputs: { result: res.data },
    logs: [`Travis CI build cancel → ${buildId}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_travisci',
  name: 'Travis CI',
  description: 'List, get, restart and cancel builds on Travis CI.',
  iconName: 'LuConstruction',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'travisci' },
  actions: [
    {
      id: 'build_list',
      label: 'List builds',
      description: 'List recent builds for a repo.',
      fields: [
        { id: 'slug', label: 'Repo slug', type: 'text', required: true, placeholder: 'owner/repo' },
        { id: 'limit', label: 'Limit', type: 'number', placeholder: '25' },
      ],
      run: buildList,
    },
    {
      id: 'build_get',
      label: 'Get build',
      description: 'Fetch a build by id.',
      fields: [
        { id: 'buildId', label: 'Build ID', type: 'text', required: true },
      ],
      run: buildGet,
    },
    {
      id: 'build_restart',
      label: 'Restart build',
      description: 'Re-queue a finished build.',
      fields: [
        { id: 'buildId', label: 'Build ID', type: 'text', required: true },
      ],
      run: buildRestart,
    },
    {
      id: 'build_cancel',
      label: 'Cancel build',
      description: 'Cancel a running build.',
      fields: [
        { id: 'buildId', label: 'Build ID', type: 'text', required: true },
      ],
      run: buildCancel,
    },
  ],
};

registerForgeBlock(block);
export default block;
