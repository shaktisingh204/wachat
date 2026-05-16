/**
 * Forge block: Gong
 *
 * Source: n8n-master/packages/nodes-base/nodes/Gong/Gong.node.ts
 *
 * Auth: Basic (accessKey:accessKeySecret).
 *
 * Operations covered:
 *   - call.list           POST /v2/calls/extensive
 *   - call.get            GET  /v2/calls/{id}
 *   - transcript.get      POST /v2/calls/transcript
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.gong.io';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.accessKey);
  const secret = asString(ctx.options.accessKeySecret);
  if (!key || !secret) throw new Error('Gong: accessKey and accessKeySecret are required');
  return {
    Authorization: `Basic ${btoa(`${key}:${secret}`)}`,
    Accept: 'application/json',
  };
}

async function callList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const fromDate = asString(ctx.options.fromDate);
  const toDate = asString(ctx.options.toDate);
  const filter: Record<string, unknown> = {};
  if (fromDate) filter.fromDateTime = fromDate;
  if (toDate) filter.toDateTime = toDate;
  const body = { filter };
  const res = await apiRequest({
    service: 'Gong',
    method: 'POST',
    url: `${API}/v2/calls/extensive`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { calls: res.data }, logs: ['Gong call list'] };
}

async function callGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.callId);
  if (!id) throw new Error('Gong: callId is required');
  const res = await apiRequest({
    service: 'Gong',
    method: 'GET',
    url: `${API}/v2/calls/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { call: res.data }, logs: [`Gong call get → ${id}`] };
}

async function transcriptGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.callId);
  if (!id) throw new Error('Gong: callId is required');
  const body = { filter: { callIds: [id] } };
  const res = await apiRequest({
    service: 'Gong',
    method: 'POST',
    url: `${API}/v2/calls/transcript`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { transcript: res.data }, logs: [`Gong transcript get → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_gong',
  name: 'Gong',
  description: 'Fetch Gong calls and transcripts.',
  iconName: 'LuPhone',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'call_list',
      label: 'List calls',
      description: 'Fetch calls in an optional date window.',
      fields: [
        { id: 'accessKey', label: 'Access key', type: 'password', required: true },
        { id: 'accessKeySecret', label: 'Access key secret', type: 'password', required: true },
        { id: 'fromDate', label: 'From (ISO 8601)', type: 'text' },
        { id: 'toDate', label: 'To (ISO 8601)', type: 'text' },
      ],
      run: callList,
    },
    {
      id: 'call_get',
      label: 'Get call',
      description: 'Fetch a single call by id.',
      fields: [
        { id: 'accessKey', label: 'Access key', type: 'password', required: true },
        { id: 'accessKeySecret', label: 'Access key secret', type: 'password', required: true },
        { id: 'callId', label: 'Call ID', type: 'text', required: true },
      ],
      run: callGet,
    },
    {
      id: 'transcript_get',
      label: 'Get transcript',
      description: 'Fetch the transcript of a call.',
      fields: [
        { id: 'accessKey', label: 'Access key', type: 'password', required: true },
        { id: 'accessKeySecret', label: 'Access key secret', type: 'password', required: true },
        { id: 'callId', label: 'Call ID', type: 'text', required: true },
      ],
      run: transcriptGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
