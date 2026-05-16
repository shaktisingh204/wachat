/**
 * Forge block: AWS SES
 *
 * Source: n8n-master/packages/nodes-base/nodes/Aws/SES/AwsSes.node.ts
 *
 * Dynamic-imports `@aws-sdk/client-ses`.
 *
 * Actions: send-email, send-templated-email, list-identities.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock, ForgeField } from '../../../types';
import { asNumber, asString } from '../_shared/http';
import { optionalImport } from '../_shared/optional_import';

type AwsCred = { accessKeyId: string; secretAccessKey: string; region: string };

function readCred(ctx: ForgeActionContext): AwsCred {
  const accessKeyId = asString(ctx.options.accessKeyId);
  const secretAccessKey = asString(ctx.options.secretAccessKey);
  const region = asString(ctx.options.region);
  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error('AWS SES: accessKeyId, secretAccessKey and region are required');
  }
  return { accessKeyId, secretAccessKey, region };
}

type SdkClient = {
  send: (cmd: unknown) => Promise<Record<string, unknown>>;
  destroy?: () => void;
};

type SesSdk = Record<string, unknown> & {
  SESClient: new (cfg: Record<string, unknown>) => SdkClient;
};

async function loadSdk(): Promise<SesSdk> {
  try {
    const mod = await optionalImport<Record<string, unknown>>('@aws-sdk/client-ses');
    const real = ((mod as { default?: Record<string, unknown> }).default ?? mod) as SesSdk;
    if (typeof real.SESClient !== 'function') throw new Error('SESClient missing');
    return real;
  } catch {
    throw new Error("AWS SES: install '@aws-sdk/client-ses' to use this block");
  }
}

function clientFor(cred: AwsCred, sdk: SesSdk): SdkClient {
  return new sdk.SESClient({
    region: cred.region,
    credentials: { accessKeyId: cred.accessKeyId, secretAccessKey: cred.secretAccessKey },
  });
}

async function runCommand(sdk: SesSdk, cmdName: string, input: Record<string, unknown>, cred: AwsCred): Promise<Record<string, unknown>> {
  const Ctor = sdk[cmdName] as undefined | (new (i: Record<string, unknown>) => unknown);
  if (typeof Ctor !== 'function') {
    throw new Error(`AWS SES: ${cmdName} not available in SDK`);
  }
  const client = clientFor(cred, sdk);
  try {
    return await client.send(new Ctor(input));
  } finally {
    client.destroy?.();
  }
}

function splitList(raw: unknown): string[] {
  return asString(raw)
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function sendEmail(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const Source = asString(ctx.options.source);
  if (!Source) throw new Error('AWS SES: source (from address) is required');
  const ToAddresses = splitList(ctx.options.toAddresses);
  if (ToAddresses.length === 0) throw new Error('AWS SES: toAddresses is required');
  const CcAddresses = splitList(ctx.options.ccAddresses);
  const BccAddresses = splitList(ctx.options.bccAddresses);
  const subject = asString(ctx.options.subject);
  if (!subject) throw new Error('AWS SES: subject is required');
  const htmlBody = asString(ctx.options.htmlBody);
  const textBody = asString(ctx.options.textBody);
  if (!htmlBody && !textBody) throw new Error('AWS SES: provide htmlBody or textBody');

  const Body: Record<string, unknown> = {};
  if (htmlBody) Body.Html = { Charset: 'UTF-8', Data: htmlBody };
  if (textBody) Body.Text = { Charset: 'UTF-8', Data: textBody };

  const input: Record<string, unknown> = {
    Source,
    Destination: { ToAddresses, CcAddresses, BccAddresses },
    Message: {
      Subject: { Charset: 'UTF-8', Data: subject },
      Body,
    },
  };
  const replyTo = splitList(ctx.options.replyToAddresses);
  if (replyTo.length) input.ReplyToAddresses = replyTo;

  const res = await runCommand(sdk, 'SendEmailCommand', input, cred);
  return {
    outputs: { messageId: res.MessageId ?? null },
    logs: [`SES SendEmail → ${ToAddresses.join(', ')} (id ${asString(res.MessageId) || 'n/a'})`],
  };
}

async function sendTemplatedEmail(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const Source = asString(ctx.options.source);
  if (!Source) throw new Error('AWS SES: source is required');
  const ToAddresses = splitList(ctx.options.toAddresses);
  if (ToAddresses.length === 0) throw new Error('AWS SES: toAddresses is required');
  const Template = asString(ctx.options.template);
  if (!Template) throw new Error('AWS SES: template is required');
  const dataRaw = asString(ctx.options.templateData).trim() || '{}';
  let TemplateData: string;
  try {
    JSON.parse(dataRaw);
    TemplateData = dataRaw;
  } catch (err) {
    throw new Error(`AWS SES: templateData is not valid JSON — ${(err as Error).message}`);
  }
  const input: Record<string, unknown> = {
    Source,
    Destination: { ToAddresses },
    Template,
    TemplateData,
  };
  const res = await runCommand(sdk, 'SendTemplatedEmailCommand', input, cred);
  return {
    outputs: { messageId: res.MessageId ?? null },
    logs: [`SES SendTemplatedEmail ${Template} → ${ToAddresses.join(', ')}`],
  };
}

async function listIdentities(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const MaxItems = asNumber(ctx.options.maxItems) ?? 100;
  const IdentityType = asString(ctx.options.identityType) || undefined;
  const input: Record<string, unknown> = { MaxItems };
  if (IdentityType) input.IdentityType = IdentityType;
  const res = await runCommand(sdk, 'ListIdentitiesCommand', input, cred);
  const identities = (res.Identities as string[] | undefined) ?? [];
  return {
    outputs: { identities, nextToken: res.NextToken ?? null },
    logs: [`SES ListIdentities → ${identities.length} identity/identities`],
  };
}

const CRED_FIELDS: ForgeField[] = [
  { id: 'accessKeyId', label: 'Access key id', type: 'password', required: true },
  { id: 'secretAccessKey', label: 'Secret access key', type: 'password', required: true },
  { id: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-east-1' },
];

const block: ForgeBlock = {
  id: 'forge_aws_ses',
  name: 'AWS SES',
  description: 'Send transactional and templated email through Amazon SES.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'send_email',
      label: 'Send email',
      description: 'Send a one-off HTML/text email via SendEmail.',
      fields: [
        ...CRED_FIELDS,
        { id: 'source', label: 'From', type: 'text', required: true, placeholder: 'sender@example.com' },
        { id: 'toAddresses', label: 'To (comma-separated)', type: 'text', required: true },
        { id: 'ccAddresses', label: 'CC (comma-separated)', type: 'text' },
        { id: 'bccAddresses', label: 'BCC (comma-separated)', type: 'text' },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'htmlBody', label: 'HTML body', type: 'textarea' },
        { id: 'textBody', label: 'Text body', type: 'textarea' },
        { id: 'replyToAddresses', label: 'Reply-To (comma-separated)', type: 'text' },
      ],
      run: sendEmail,
    },
    {
      id: 'send_templated_email',
      label: 'Send templated email',
      description: 'SendTemplatedEmail with a registered SES template.',
      fields: [
        ...CRED_FIELDS,
        { id: 'source', label: 'From', type: 'text', required: true },
        { id: 'toAddresses', label: 'To (comma-separated)', type: 'text', required: true },
        { id: 'template', label: 'Template name', type: 'text', required: true },
        { id: 'templateData', label: 'Template data (JSON)', type: 'json', defaultValue: '{}' },
      ],
      run: sendTemplatedEmail,
    },
    {
      id: 'list_identities',
      label: 'List identities',
      description: 'ListIdentities (verified senders).',
      fields: [
        ...CRED_FIELDS,
        {
          id: 'identityType',
          label: 'Identity type',
          type: 'select',
          options: [
            { label: 'Any', value: '' },
            { label: 'EmailAddress', value: 'EmailAddress' },
            { label: 'Domain', value: 'Domain' },
          ],
        },
        { id: 'maxItems', label: 'Max items', type: 'number', defaultValue: 100 },
      ],
      run: listIdentities,
    },
  ],
};

registerForgeBlock(block);
export default block;
