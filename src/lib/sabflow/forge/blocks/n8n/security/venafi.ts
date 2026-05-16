/**
 * Forge block: Venafi TLS Protect Datacenter
 *
 * Source: n8n-master/packages/nodes-base/nodes/Venafi/Datacenter/VenafiTlsProtectDatacenter.node.ts
 *
 * Bearer access token against the configured TPP / VEDsdk base URL.
 *
 * Operations covered:
 *   - certificate.list      POST /vedsdk/Certificates/
 *   - certificate.request   POST /vedsdk/Certificates/Request
 *   - certificate.retrieve  GET  /vedsdk/Certificates/Retrieve
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function base(ctx: ForgeActionContext): string {
  const raw = asString(ctx.options.baseUrl);
  if (!raw) throw new Error('Venafi: baseUrl is required');
  return raw.replace(/\/+$/, '');
}

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('Venafi: accessToken is required');
  return { Authorization: `Bearer ${token}` };
}

async function certificateList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Venafi',
    method: 'GET',
    url: `${base(ctx)}/vedsdk/Certificates/`,
    headers: authHeader(ctx),
  });
  return { outputs: { certificates: res.data }, logs: ['Venafi certificate.list'] };
}

async function certificateRequest(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const policyDN = asString(ctx.options.policyDN);
  const subject = asString(ctx.options.subject);
  if (!policyDN || !subject) {
    throw new Error('Venafi: policyDN and subject are required');
  }
  const body: Record<string, unknown> = { PolicyDN: policyDN, Subject: subject };
  const approvers = asString(ctx.options.approvers);
  const sans = asString(ctx.options.subjectAltNames);
  if (approvers) body.Approvers = approvers.split(',').map((a) => a.trim()).filter(Boolean);
  if (sans) {
    body.SubjectAltNames = sans.split(',').map((s) => {
      const v = s.trim();
      return { TypeName: 'DNS', Name: v };
    });
  }
  const res = await apiRequest({
    service: 'Venafi',
    method: 'POST',
    url: `${base(ctx)}/vedsdk/Certificates/Request`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { certificate: res.data }, logs: [`Venafi certificate.request → ${subject}`] };
}

async function certificateRetrieve(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const certificateDN = asString(ctx.options.certificateDN);
  if (!certificateDN) throw new Error('Venafi: certificateDN is required');
  const format = asString(ctx.options.format) || 'Base64';
  const params = new URLSearchParams({ CertificateDN: certificateDN, Format: format });
  const res = await apiRequest({
    service: 'Venafi',
    method: 'GET',
    url: `${base(ctx)}/vedsdk/Certificates/Retrieve?${params.toString()}`,
    headers: authHeader(ctx),
  });
  return { outputs: { certificate: res.data }, logs: [`Venafi certificate.retrieve → ${certificateDN}`] };
}

const credFields = [
  { id: 'baseUrl', label: 'TPP base URL', type: 'text' as const, required: true, placeholder: 'https://tpp.example.com' },
  { id: 'accessToken', label: 'Access token', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_venafi',
  name: 'Venafi TLS Protect',
  description: 'Manage certificates inside a Venafi TPP / TLS Protect Datacenter instance.',
  iconName: 'LuLock',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'certificate_list',
      label: 'List certificates',
      description: 'List certificates known to the configured access token.',
      fields: [...credFields],
      run: certificateList,
    },
    {
      id: 'certificate_request',
      label: 'Request certificate',
      description: 'Request a new certificate from a policy folder.',
      fields: [
        ...credFields,
        { id: 'policyDN', label: 'Policy DN', type: 'text', required: true, placeholder: '\\VED\\Policy\\Certificates' },
        { id: 'subject', label: 'Subject (CN)', type: 'text', required: true, placeholder: 'host.example.com' },
        { id: 'subjectAltNames', label: 'Subject alt names (DNS, comma-separated)', type: 'text' },
        { id: 'approvers', label: 'Approvers (comma-separated)', type: 'text' },
      ],
      run: certificateRequest,
    },
    {
      id: 'certificate_retrieve',
      label: 'Retrieve certificate',
      description: 'Retrieve a certificate body by DN.',
      fields: [
        ...credFields,
        { id: 'certificateDN', label: 'Certificate DN', type: 'text', required: true },
        { id: 'format', label: 'Format', type: 'select', defaultValue: 'Base64', options: [
          { label: 'Base64', value: 'Base64' },
          { label: 'PKCS #7', value: 'PKCS #7' },
          { label: 'DER', value: 'DER' },
        ] },
      ],
      run: certificateRetrieve,
    },
  ],
};

registerForgeBlock(block);
export default block;
