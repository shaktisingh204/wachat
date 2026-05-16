/**
 * Forge block: AWS SQS
 *
 * Source: n8n-master/packages/nodes-base/nodes/Aws/SQS/AwsSqs.node.ts
 *
 * Dynamic-imports `@aws-sdk/client-sqs`.
 *
 * Actions: send-message, receive-messages, delete-message, get-queue-url.
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
    throw new Error('AWS SQS: accessKeyId, secretAccessKey and region are required');
  }
  return { accessKeyId, secretAccessKey, region };
}

type SdkClient = {
  send: (cmd: unknown) => Promise<Record<string, unknown>>;
  destroy?: () => void;
};

type SqsSdk = Record<string, unknown> & {
  SQSClient: new (cfg: Record<string, unknown>) => SdkClient;
};

async function loadSdk(): Promise<SqsSdk> {
  try {
    const mod = await optionalImport<Record<string, unknown>>('@aws-sdk/client-sqs');
    const real = ((mod as { default?: Record<string, unknown> }).default ?? mod) as SqsSdk;
    if (typeof real.SQSClient !== 'function') throw new Error('SQSClient missing');
    return real;
  } catch {
    throw new Error("AWS SQS: install '@aws-sdk/client-sqs' to use this block");
  }
}

function clientFor(cred: AwsCred, sdk: SqsSdk): SdkClient {
  return new sdk.SQSClient({
    region: cred.region,
    credentials: { accessKeyId: cred.accessKeyId, secretAccessKey: cred.secretAccessKey },
  });
}

async function runCommand(sdk: SqsSdk, cmdName: string, input: Record<string, unknown>, cred: AwsCred): Promise<Record<string, unknown>> {
  const Ctor = sdk[cmdName] as undefined | (new (i: Record<string, unknown>) => unknown);
  if (typeof Ctor !== 'function') {
    throw new Error(`AWS SQS: ${cmdName} not available in SDK`);
  }
  const client = clientFor(cred, sdk);
  try {
    return await client.send(new Ctor(input));
  } finally {
    client.destroy?.();
  }
}

async function sendMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const QueueUrl = asString(ctx.options.queueUrl);
  if (!QueueUrl) throw new Error('AWS SQS: queueUrl is required');
  const MessageBody = asString(ctx.options.messageBody);
  if (!MessageBody) throw new Error('AWS SQS: messageBody is required');
  const input: Record<string, unknown> = { QueueUrl, MessageBody };
  const DelaySeconds = asNumber(ctx.options.delaySeconds);
  if (DelaySeconds !== undefined) input.DelaySeconds = DelaySeconds;
  const MessageGroupId = asString(ctx.options.messageGroupId);
  if (MessageGroupId) input.MessageGroupId = MessageGroupId;
  const MessageDeduplicationId = asString(ctx.options.messageDeduplicationId);
  if (MessageDeduplicationId) input.MessageDeduplicationId = MessageDeduplicationId;

  const res = await runCommand(sdk, 'SendMessageCommand', input, cred);
  return {
    outputs: {
      messageId: res.MessageId ?? null,
      sequenceNumber: res.SequenceNumber ?? null,
      md5OfMessageBody: res.MD5OfMessageBody ?? null,
    },
    logs: [`SQS SendMessage → ${QueueUrl}`],
  };
}

async function receiveMessages(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const QueueUrl = asString(ctx.options.queueUrl);
  if (!QueueUrl) throw new Error('AWS SQS: queueUrl is required');
  const MaxNumberOfMessages = asNumber(ctx.options.maxNumberOfMessages) ?? 1;
  const WaitTimeSeconds = asNumber(ctx.options.waitTimeSeconds) ?? 0;
  const VisibilityTimeout = asNumber(ctx.options.visibilityTimeout);
  const input: Record<string, unknown> = { QueueUrl, MaxNumberOfMessages, WaitTimeSeconds };
  if (VisibilityTimeout !== undefined) input.VisibilityTimeout = VisibilityTimeout;
  const res = await runCommand(sdk, 'ReceiveMessageCommand', input, cred);
  const messages = (res.Messages as unknown[] | undefined) ?? [];
  return {
    outputs: { messages, count: messages.length },
    logs: [`SQS ReceiveMessage ${QueueUrl} → ${messages.length} message(s)`],
  };
}

async function deleteMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const QueueUrl = asString(ctx.options.queueUrl);
  if (!QueueUrl) throw new Error('AWS SQS: queueUrl is required');
  const ReceiptHandle = asString(ctx.options.receiptHandle);
  if (!ReceiptHandle) throw new Error('AWS SQS: receiptHandle is required');
  await runCommand(sdk, 'DeleteMessageCommand', { QueueUrl, ReceiptHandle }, cred);
  return {
    outputs: { deleted: true, queueUrl: QueueUrl },
    logs: [`SQS DeleteMessage ${QueueUrl}`],
  };
}

async function getQueueUrl(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const QueueName = asString(ctx.options.queueName);
  if (!QueueName) throw new Error('AWS SQS: queueName is required');
  const QueueOwnerAWSAccountId = asString(ctx.options.queueOwnerAWSAccountId);
  const input: Record<string, unknown> = { QueueName };
  if (QueueOwnerAWSAccountId) input.QueueOwnerAWSAccountId = QueueOwnerAWSAccountId;
  const res = await runCommand(sdk, 'GetQueueUrlCommand', input, cred);
  return {
    outputs: { queueUrl: res.QueueUrl ?? null },
    logs: [`SQS GetQueueUrl ${QueueName} → ${asString(res.QueueUrl) || 'n/a'}`],
  };
}

const CRED_FIELDS: ForgeField[] = [
  { id: 'accessKeyId', label: 'Access key id', type: 'password', required: true },
  { id: 'secretAccessKey', label: 'Secret access key', type: 'password', required: true },
  { id: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-east-1' },
];

const block: ForgeBlock = {
  id: 'forge_aws_sqs',
  name: 'AWS SQS',
  description: 'Produce and consume messages on Amazon SQS queues.',
  iconName: 'LuListOrdered',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'send_message',
      label: 'Send message',
      description: 'SendMessage to a queue URL.',
      fields: [
        ...CRED_FIELDS,
        { id: 'queueUrl', label: 'Queue URL', type: 'text', required: true, placeholder: 'https://sqs.us-east-1.amazonaws.com/123/queue' },
        { id: 'messageBody', label: 'Message body', type: 'textarea', required: true },
        { id: 'delaySeconds', label: 'Delay seconds', type: 'number' },
        { id: 'messageGroupId', label: 'MessageGroupId (FIFO)', type: 'text' },
        { id: 'messageDeduplicationId', label: 'MessageDeduplicationId (FIFO)', type: 'text' },
      ],
      run: sendMessage,
    },
    {
      id: 'receive_messages',
      label: 'Receive messages',
      description: 'ReceiveMessage with optional long-polling.',
      fields: [
        ...CRED_FIELDS,
        { id: 'queueUrl', label: 'Queue URL', type: 'text', required: true },
        { id: 'maxNumberOfMessages', label: 'Max messages (1-10)', type: 'number', defaultValue: 1 },
        { id: 'waitTimeSeconds', label: 'Wait time seconds (0-20)', type: 'number', defaultValue: 0 },
        { id: 'visibilityTimeout', label: 'Visibility timeout (s)', type: 'number' },
      ],
      run: receiveMessages,
    },
    {
      id: 'delete_message',
      label: 'Delete message',
      description: 'DeleteMessage by receipt handle.',
      fields: [
        ...CRED_FIELDS,
        { id: 'queueUrl', label: 'Queue URL', type: 'text', required: true },
        { id: 'receiptHandle', label: 'Receipt handle', type: 'text', required: true },
      ],
      run: deleteMessage,
    },
    {
      id: 'get_queue_url',
      label: 'Get queue URL',
      description: 'Resolve a queue name to its URL.',
      fields: [
        ...CRED_FIELDS,
        { id: 'queueName', label: 'Queue name', type: 'text', required: true },
        { id: 'queueOwnerAWSAccountId', label: 'Queue owner AWS account id', type: 'text' },
      ],
      run: getQueueUrl,
    },
  ],
};

registerForgeBlock(block);
export default block;
