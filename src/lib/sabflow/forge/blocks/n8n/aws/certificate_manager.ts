/**
 * Forge block: AWS Certificate Manager (ACM)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Aws/CertificateManager/AwsCertificateManager.node.ts
 *
 * Dynamic-imports `@aws-sdk/client-acm`.
 *
 * Actions: list-certificates, describe-certificate, request-certificate.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock, ForgeField } from '../../../types';
import { asNumber, asString } from '../_shared/http';

type AwsCred = { accessKeyId: string; secretAccessKey: string; region: string };

function readCred(ctx: ForgeActionContext): AwsCred {
  const accessKeyId = asString(ctx.options.accessKeyId);
  const secretAccessKey = asString(ctx.options.secretAccessKey);
  const region = asString(ctx.options.region);
  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error('AWS ACM: accessKeyId, secretAccessKey and region are required');
  }
  return { accessKeyId, secretAccessKey, region };
}

type SdkClient = {
  send: (cmd: unknown) => Promise<Record<string, unknown>>;
  destroy?: () => void;
};

type AcmSdk = Record<string, unknown> & {
  ACMClient: new (cfg: Record<string, unknown>) => SdkClient;
};

async function loadSdk(): Promise<AcmSdk> {
  try {
    const mod = (await import('@aws-sdk/client-acm' as string)) as Record<string, unknown>;
    const real = ((mod as { default?: Record<string, unknown> }).default ?? mod) as AcmSdk;
    if (typeof real.ACMClient !== 'function') throw new Error('ACMClient missing');
    return real;
  } catch {
    throw new Error("AWS ACM: install '@aws-sdk/client-acm' to use this block");
  }
}

function clientFor(cred: AwsCred, sdk: AcmSdk): SdkClient {
  return new sdk.ACMClient({
    region: cred.region,
    credentials: { accessKeyId: cred.accessKeyId, secretAccessKey: cred.secretAccessKey },
  });
}

async function runCommand(sdk: AcmSdk, cmdName: string, input: Record<string, unknown>, cred: AwsCred): Promise<Record<string, unknown>> {
  const Ctor = sdk[cmdName] as undefined | (new (i: Record<string, unknown>) => unknown);
  if (typeof Ctor !== 'function') {
    throw new Error(`AWS ACM: ${cmdName} not available in SDK`);
  }
  const client = clientFor(cred, sdk);
  try {
    return await client.send(new Ctor(input));
  } finally {
    client.destroy?.();
  }
}

async function listCertificates(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const MaxItems = asNumber(ctx.options.maxItems) ?? 100;
  const statuses = asString(ctx.options.certificateStatuses).trim();
  const input: Record<string, unknown> = { MaxItems };
  if (statuses) {
    input.CertificateStatuses = statuses
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }
  const NextToken = asString(ctx.options.nextToken);
  if (NextToken) input.NextToken = NextToken;
  const res = await runCommand(sdk, 'ListCertificatesCommand', input, cred);
  const summaries = (res.CertificateSummaryList as unknown[] | undefined) ?? [];
  return {
    outputs: { certificateSummaryList: summaries, nextToken: res.NextToken ?? null },
    logs: [`ACM ListCertificates → ${summaries.length} certificate(s)`],
  };
}

async function describeCertificate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const CertificateArn = asString(ctx.options.certificateArn);
  if (!CertificateArn) throw new Error('AWS ACM: certificateArn is required');
  const res = await runCommand(sdk, 'DescribeCertificateCommand', { CertificateArn }, cred);
  return {
    outputs: { certificate: res.Certificate ?? null },
    logs: [`ACM DescribeCertificate ${CertificateArn}`],
  };
}

async function requestCertificate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const DomainName = asString(ctx.options.domainName);
  if (!DomainName) throw new Error('AWS ACM: domainName is required');
  const ValidationMethod = asString(ctx.options.validationMethod) || 'DNS';
  const sans = asString(ctx.options.subjectAlternativeNames).trim();
  const input: Record<string, unknown> = { DomainName, ValidationMethod };
  if (sans) {
    input.SubjectAlternativeNames = sans
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const IdempotencyToken = asString(ctx.options.idempotencyToken);
  if (IdempotencyToken) input.IdempotencyToken = IdempotencyToken;
  const res = await runCommand(sdk, 'RequestCertificateCommand', input, cred);
  return {
    outputs: { certificateArn: res.CertificateArn ?? null },
    logs: [`ACM RequestCertificate ${DomainName} → ${asString(res.CertificateArn) || 'n/a'}`],
  };
}

const CRED_FIELDS: ForgeField[] = [
  { id: 'accessKeyId', label: 'Access key id', type: 'password', required: true },
  { id: 'secretAccessKey', label: 'Secret access key', type: 'password', required: true },
  { id: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-east-1' },
];

const block: ForgeBlock = {
  id: 'forge_aws_cert_manager',
  name: 'AWS Certificate Manager',
  description: 'List, describe and request ACM TLS certificates.',
  iconName: 'LuShieldCheck',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'list_certificates',
      label: 'List certificates',
      description: 'ListCertificates with optional status filter.',
      fields: [
        ...CRED_FIELDS,
        { id: 'certificateStatuses', label: 'Statuses (CSV)', type: 'text', placeholder: 'ISSUED, PENDING_VALIDATION' },
        { id: 'maxItems', label: 'Max items', type: 'number', defaultValue: 100 },
        { id: 'nextToken', label: 'Next token', type: 'text' },
      ],
      run: listCertificates,
    },
    {
      id: 'describe_certificate',
      label: 'Describe certificate',
      description: 'DescribeCertificate by ARN.',
      fields: [
        ...CRED_FIELDS,
        { id: 'certificateArn', label: 'Certificate ARN', type: 'text', required: true },
      ],
      run: describeCertificate,
    },
    {
      id: 'request_certificate',
      label: 'Request certificate',
      description: 'RequestCertificate for a domain (DNS validation by default).',
      fields: [
        ...CRED_FIELDS,
        { id: 'domainName', label: 'Domain name', type: 'text', required: true, placeholder: 'example.com' },
        { id: 'subjectAlternativeNames', label: 'SANs (CSV)', type: 'text', placeholder: 'www.example.com, api.example.com' },
        {
          id: 'validationMethod',
          label: 'Validation method',
          type: 'select',
          defaultValue: 'DNS',
          options: [
            { label: 'DNS', value: 'DNS' },
            { label: 'EMAIL', value: 'EMAIL' },
          ],
        },
        { id: 'idempotencyToken', label: 'Idempotency token', type: 'text' },
      ],
      run: requestCertificate,
    },
  ],
};

registerForgeBlock(block);
export default block;
