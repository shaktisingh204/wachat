/**
 * Forge block: Venafi TLS Protect Cloud
 *
 * Source: n8n-master/packages/nodes-base/nodes/Venafi/ProtectCloud/VenafiTlsProtectCloud.node.ts
 *
 * Hits the Venafi Cloud Outagedetection API. Auth is a tenant-scoped API
 * key passed via the `tppl-api-key` header (a bearer-ish flow; Venafi calls
 * it "API key" in the dashboard).
 *
 * Operations covered:
 *   - cert.list      GET /outagedetection/v1/certificates
 *   - cert.request   POST /outagedetection/v1/certificaterequests
 *   - cert.retrieve  GET /outagedetection/v1/certificates/<id>
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import { parseJsonObject } from '../_shared/json';

const DEFAULT_BASE_URL = 'https://api.venafi.cloud';

function readAuth(ctx: ForgeActionContext): { url: string; key: string } {
  const baseUrl = (asString(ctx.options.baseUrl) || DEFAULT_BASE_URL).replace(/\/$/, '');
  const key = asString(ctx.options.apiKey);
  if (!key) throw new Error('Venafi: apiKey is required');
  return { url: baseUrl, key };
}

function authHeaders(key: string): Record<string, string> {
  return {
    'tppl-api-key': key,
    Accept: 'application/json',
  };
}

async function certList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { url, key } = readAuth(ctx);
  const limit = asString(ctx.options.limit);
  const query = limit ? `?limit=${encodeURIComponent(limit)}` : '';
  const res = await apiRequest({
    service: 'Venafi',
    method: 'GET',
    url: `${url}/outagedetection/v1/certificates${query}`,
    headers: authHeaders(key),
  });
  const data = res.data as { certificates?: unknown[] } | undefined;
  const certs = Array.isArray(data?.certificates) ? data!.certificates! : [];
  return {
    outputs: { certificates: certs, count: certs.length, response: res.data },
    logs: [`Venafi cert.list → ${certs.length} certificate(s)`],
  };
}

async function certRequest(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { url, key } = readAuth(ctx);
  const body = parseJsonObject(ctx.options.body, 'body');
  const res = await apiRequest({
    service: 'Venafi',
    method: 'POST',
    url: `${url}/outagedetection/v1/certificaterequests`,
    headers: authHeaders(key),
    json: body,
  });
  return { outputs: { response: res.data }, logs: ['Venafi cert.request → submitted'] };
}

async function certRetrieve(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { url, key } = readAuth(ctx);
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Venafi: certificate id is required');
  const res = await apiRequest({
    service: 'Venafi',
    method: 'GET',
    url: `${url}/outagedetection/v1/certificates/${encodeURIComponent(id)}`,
    headers: authHeaders(key),
  });
  return { outputs: { certificate: res.data }, logs: [`Venafi cert.retrieve → ${id}`] };
}

const AUTH_FIELDS = [
  {
    id: 'apiKey',
    label: 'API key',
    type: 'password' as const,
    required: true,
    helperText: 'Tenant API key — sent as the tppl-api-key header.',
  },
  {
    id: 'baseUrl',
    label: 'Base URL',
    type: 'text' as const,
    placeholder: DEFAULT_BASE_URL,
    helperText: 'Override for non-US tenants (e.g. https://api.venafi.eu).',
  },
];

const block: ForgeBlock = {
  id: 'forge_venafi_cloud',
  name: 'Venafi TLS Protect Cloud',
  description: 'List, request and retrieve certificates from Venafi Cloud.',
  iconName: 'LuShieldCheck',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'cert_list',
      label: 'List certificates',
      description: 'GET /outagedetection/v1/certificates with an optional limit.',
      fields: [
        ...AUTH_FIELDS,
        { id: 'limit', label: 'Limit', type: 'number', placeholder: '50' },
      ],
      run: certList,
    },
    {
      id: 'cert_request',
      label: 'Request certificate',
      description: 'POST /outagedetection/v1/certificaterequests with a JSON request payload.',
      fields: [
        ...AUTH_FIELDS,
        {
          id: 'body',
          label: 'Request payload (JSON)',
          type: 'json',
          required: true,
          placeholder: '{"certificateIssuingTemplateId":"…","csrAttributes":{"commonName":"example.com"}}',
        },
      ],
      run: certRequest,
    },
    {
      id: 'cert_retrieve',
      label: 'Retrieve certificate',
      description: 'GET /outagedetection/v1/certificates/<id>.',
      fields: [
        ...AUTH_FIELDS,
        { id: 'id', label: 'Certificate id', type: 'text', required: true },
      ],
      run: certRetrieve,
    },
  ],
};

registerForgeBlock(block);
export default block;
