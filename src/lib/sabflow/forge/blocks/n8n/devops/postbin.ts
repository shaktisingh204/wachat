/**
 * Forge block: PostBin
 *
 * Source: n8n-master/packages/nodes-base/nodes/PostBin/PostBin.node.ts
 *
 * PostBin is a free, anonymous HTTP bin used to inspect webhook traffic. No
 * credentials required.
 *
 * Operations covered (https://www.toptal.com/developers/postbin/api):
 *   - bin.create          POST   /api/bin
 *   - bin.get             GET    /api/bin/{binId}
 *   - request.get-by-id   GET    /api/bin/{binId}/req/{reqId}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://www.toptal.com/developers/postbin/api';

async function binCreate(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'PostBin',
    method: 'POST',
    url: `${API}/bin`,
  });
  const body = res.data as { binId?: string };
  return {
    outputs: { bin: res.data, binId: body?.binId },
    logs: [`PostBin bin create → ${body?.binId ?? '?'}`],
  };
}

async function binGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const binId = asString(ctx.options.binId);
  if (!binId) throw new Error('PostBin: binId is required');
  const res = await apiRequest({
    service: 'PostBin',
    method: 'GET',
    url: `${API}/bin/${encodeURIComponent(binId)}`,
  });
  return {
    outputs: { bin: res.data },
    logs: [`PostBin bin get → ${binId}`],
  };
}

async function requestGetById(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const binId = asString(ctx.options.binId);
  const reqId = asString(ctx.options.reqId);
  if (!binId) throw new Error('PostBin: binId is required');
  if (!reqId) throw new Error('PostBin: reqId is required');
  const res = await apiRequest({
    service: 'PostBin',
    method: 'GET',
    url: `${API}/bin/${encodeURIComponent(binId)}/req/${encodeURIComponent(reqId)}`,
  });
  return {
    outputs: { request: res.data },
    logs: [`PostBin request get → ${binId}/${reqId}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_postbin',
  name: 'PostBin',
  description: 'Create ephemeral HTTP bins and read captured requests.',
  iconName: 'LuInbox',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'bin_create',
      label: 'Create bin',
      description: 'Create a new ephemeral bin.',
      fields: [],
      run: binCreate,
    },
    {
      id: 'bin_get',
      label: 'Get bin',
      description: 'Read bin metadata by id.',
      fields: [
        { id: 'binId', label: 'Bin ID', type: 'text', required: true },
      ],
      run: binGet,
    },
    {
      id: 'request_get_by_id',
      label: 'Get request by ID',
      description: 'Fetch a captured request from a bin.',
      fields: [
        { id: 'binId', label: 'Bin ID', type: 'text', required: true },
        { id: 'reqId', label: 'Request ID', type: 'text', required: true },
      ],
      run: requestGetById,
    },
  ],
};

registerForgeBlock(block);
export default block;
