/**
 * Forge block: Jenkins
 *
 * Source: n8n-master/packages/nodes-base/nodes/Jenkins/Jenkins.node.ts
 * Credential type: 'jenkins' (expects { baseUrl, username, apiToken }).
 *
 * Operations covered:
 *   - job.trigger         POST {base}/job/{name}/build  (or buildWithParameters)
 *   - job.get             GET  {base}/job/{name}/api/json
 *   - build.get           GET  {base}/job/{name}/{buildNumber}/api/json
 *   - queue.get           GET  {base}/queue/item/{queueId}/api/json
 *
 * Deferred:
 *   - CSRF crumb fetch (set Jenkins to allow API-token POSTs, or proxy
 *     through a job with auth-only access)
 *   - folder-scoped jobs beyond the simple flat name
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function jenkinsConn(ctx: ForgeActionContext): { base: string; auth: string } {
  const cred = requireCredential('Jenkins', ctx.credential);
  const baseUrl = cred.baseUrl;
  const username = cred.username;
  const apiToken = cred.apiToken;
  if (!baseUrl) throw new Error('Jenkins: credential is missing `baseUrl`');
  if (!username || !apiToken) {
    throw new Error('Jenkins: credential requires `username` and `apiToken`');
  }
  return {
    base: baseUrl.replace(/\/$/, ''),
    auth: `Basic ${btoa(`${username}:${apiToken}`)}`,
  };
}

function jobPath(name: string): string {
  // Support folder paths like "folder/sub/job" → /job/folder/job/sub/job/job
  return name
    .split('/')
    .filter(Boolean)
    .map((seg) => `job/${encodeURIComponent(seg)}`)
    .join('/');
}

async function jobTrigger(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const job = asString(ctx.options.job);
  if (!job) throw new Error('Jenkins: job is required');

  const { base, auth } = jenkinsConn(ctx);
  const paramsRaw = asString(ctx.options.parameters);
  let endpoint = `${base}/${jobPath(job)}/build`;
  let url = endpoint;
  if (paramsRaw) {
    endpoint = `${base}/${jobPath(job)}/buildWithParameters`;
    const params = new URLSearchParams();
    try {
      const parsed = JSON.parse(paramsRaw) as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsed)) {
        params.set(k, typeof v === 'string' ? v : JSON.stringify(v));
      }
    } catch {
      // treat as raw form-encoded string
      url = `${endpoint}?${paramsRaw}`;
    }
    if (params.toString()) url = `${endpoint}?${params.toString()}`;
  }

  const res = await apiRequest({
    service: 'Jenkins',
    method: 'POST',
    url,
    headers: { Authorization: auth },
  });

  const queueLocation = res.headers.get('location') ?? '';
  return {
    outputs: { status: res.status, queueLocation },
    logs: [`Jenkins job trigger → ${job}`],
  };
}

async function jobGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const job = asString(ctx.options.job);
  if (!job) throw new Error('Jenkins: job is required');
  const { base, auth } = jenkinsConn(ctx);
  const res = await apiRequest({
    service: 'Jenkins',
    method: 'GET',
    url: `${base}/${jobPath(job)}/api/json`,
    headers: { Authorization: auth },
  });
  return {
    outputs: { job: res.data },
    logs: [`Jenkins job get → ${job}`],
  };
}

async function buildGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const job = asString(ctx.options.job);
  const buildNumber = asString(ctx.options.buildNumber);
  if (!job) throw new Error('Jenkins: job is required');
  if (!buildNumber) throw new Error('Jenkins: buildNumber is required');

  const { base, auth } = jenkinsConn(ctx);
  const res = await apiRequest({
    service: 'Jenkins',
    method: 'GET',
    url: `${base}/${jobPath(job)}/${encodeURIComponent(buildNumber)}/api/json`,
    headers: { Authorization: auth },
  });
  return {
    outputs: { build: res.data },
    logs: [`Jenkins build get → ${job}#${buildNumber}`],
  };
}

async function queueGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queueId = asString(ctx.options.queueId);
  if (!queueId) throw new Error('Jenkins: queueId is required');
  const { base, auth } = jenkinsConn(ctx);
  const res = await apiRequest({
    service: 'Jenkins',
    method: 'GET',
    url: `${base}/queue/item/${encodeURIComponent(queueId)}/api/json`,
    headers: { Authorization: auth },
  });
  return {
    outputs: { queueItem: res.data },
    logs: [`Jenkins queue get → ${queueId}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_jenkins',
  name: 'Jenkins',
  description: 'Trigger builds and read job state on a Jenkins server.',
  iconName: 'LuHardHat',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'jenkins' },
  actions: [
    {
      id: 'job_trigger',
      label: 'Trigger job',
      description: 'Queue a build for a job (with optional parameters).',
      fields: [
        { id: 'job', label: 'Job name', type: 'text', required: true, placeholder: 'my-job or folder/my-job' },
        {
          id: 'parameters',
          label: 'Parameters (JSON)',
          type: 'json',
          placeholder: '{"BRANCH":"main"}',
          helperText: 'When set, uses buildWithParameters.',
        },
      ],
      run: jobTrigger,
    },
    {
      id: 'job_get',
      label: 'Get job',
      description: 'Read job metadata and last builds.',
      fields: [
        { id: 'job', label: 'Job name', type: 'text', required: true },
      ],
      run: jobGet,
    },
    {
      id: 'build_get',
      label: 'Get build',
      description: 'Fetch a specific build for a job.',
      fields: [
        { id: 'job', label: 'Job name', type: 'text', required: true },
        { id: 'buildNumber', label: 'Build number', type: 'text', required: true },
      ],
      run: buildGet,
    },
    {
      id: 'queue_get',
      label: 'Get queue item',
      description: 'Inspect a queued build item by id.',
      fields: [
        { id: 'queueId', label: 'Queue item ID', type: 'text', required: true },
      ],
      run: queueGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
