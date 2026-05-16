/**
 * Forge block: Cortex (TheHive)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Cortex/Cortex.node.ts
 * Credential type: 'cortex' (expects { apiKey, host }).
 *   - host: full base URL of the Cortex server, e.g. https://cortex.example.com
 *
 * Operations:
 *   - analyzer.list   GET  {host}/api/analyzer
 *   - analyzer.run    POST {host}/api/analyzer/{id}/run
 *   - job.get         GET  {host}/api/job/{id}
 *   - job.report      GET  {host}/api/job/{id}/report
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function base(ctx: ForgeActionContext): { host: string; auth: string } {
  const cred = requireCredential('Cortex', ctx.credential);
  const host = (cred.host ?? cred.baseUrl ?? '').replace(/\/+$/, '');
  const apiKey = cred.apiKey ?? cred.accessToken;
  if (!host) throw new Error('Cortex: credential is missing `host`');
  if (!apiKey) throw new Error('Cortex: credential is missing `apiKey`');
  return { host, auth: `Bearer ${apiKey}` };
}

async function analyzerList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { host, auth } = base(ctx);
  const res = await apiRequest({
    service: 'Cortex',
    method: 'GET',
    url: `${host}/api/analyzer`,
    headers: { Authorization: auth },
  });
  const analyzers = Array.isArray(res.data) ? res.data : [];
  return {
    outputs: { analyzers, count: analyzers.length },
    logs: [`Cortex analyzer list (${analyzers.length})`],
  };
}

async function analyzerRun(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { host, auth } = base(ctx);
  const analyzerId = asString(ctx.options.analyzerId);
  const dataType = asString(ctx.options.dataType);
  const data = asString(ctx.options.data);
  if (!analyzerId) throw new Error('Cortex: analyzerId is required');
  if (!dataType) throw new Error('Cortex: dataType is required');
  if (!data) throw new Error('Cortex: data is required');

  const tlp = ctx.options.tlp !== undefined && ctx.options.tlp !== ''
    ? Number(ctx.options.tlp)
    : 2;

  const res = await apiRequest({
    service: 'Cortex',
    method: 'POST',
    url: `${host}/api/analyzer/${encodeURIComponent(analyzerId)}/run`,
    headers: { Authorization: auth },
    json: { data, dataType, tlp, message: asString(ctx.options.message) || undefined },
  });
  const job = res.data as { id?: string };
  return {
    outputs: { job: res.data },
    logs: [`Cortex analyzer run → ${analyzerId} (job ${job?.id ?? '?'})`],
  };
}

async function jobGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { host, auth } = base(ctx);
  const jobId = asString(ctx.options.jobId);
  if (!jobId) throw new Error('Cortex: jobId is required');

  const res = await apiRequest({
    service: 'Cortex',
    method: 'GET',
    url: `${host}/api/job/${encodeURIComponent(jobId)}`,
    headers: { Authorization: auth },
  });
  return { outputs: { job: res.data }, logs: [`Cortex job get → ${jobId}`] };
}

async function jobReport(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { host, auth } = base(ctx);
  const jobId = asString(ctx.options.jobId);
  if (!jobId) throw new Error('Cortex: jobId is required');

  const res = await apiRequest({
    service: 'Cortex',
    method: 'GET',
    url: `${host}/api/job/${encodeURIComponent(jobId)}/report`,
    headers: { Authorization: auth },
  });
  return { outputs: { report: res.data }, logs: [`Cortex job report → ${jobId}`] };
}

const block: ForgeBlock = {
  id: 'forge_cortex',
  name: 'Cortex',
  description: 'Run Cortex analyzers and inspect job results.',
  iconName: 'LuShield',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'cortex' },
  actions: [
    {
      id: 'analyzer_list',
      label: 'List analyzers',
      description: 'List analyzers available on the Cortex instance.',
      fields: [],
      run: analyzerList,
    },
    {
      id: 'analyzer_run',
      label: 'Run analyzer',
      description: 'Start an analyzer job against an observable.',
      fields: [
        { id: 'analyzerId', label: 'Analyzer ID', type: 'text', required: true },
        { id: 'dataType', label: 'Data type', type: 'text', required: true, placeholder: 'ip' },
        { id: 'data', label: 'Data', type: 'textarea', required: true },
        { id: 'message', label: 'Message', type: 'text' },
        { id: 'tlp', label: 'TLP', type: 'select', options: [
          { label: 'WHITE (0)', value: '0' },
          { label: 'GREEN (1)', value: '1' },
          { label: 'AMBER (2)', value: '2' },
          { label: 'RED (3)', value: '3' },
        ] },
      ],
      run: analyzerRun,
    },
    {
      id: 'job_get',
      label: 'Get job',
      description: 'Fetch a job by id.',
      fields: [
        { id: 'jobId', label: 'Job ID', type: 'text', required: true },
      ],
      run: jobGet,
    },
    {
      id: 'job_report',
      label: 'Get job report',
      description: 'Fetch the full report for a completed job.',
      fields: [
        { id: 'jobId', label: 'Job ID', type: 'text', required: true },
      ],
      run: jobReport,
    },
  ],
};

registerForgeBlock(block);
export default block;
