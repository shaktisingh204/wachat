/**
 * Forge block: AWS Lambda
 *
 * Source: n8n-master/packages/nodes-base/nodes/Aws/AwsLambda.node.ts
 * Credential type: 'aws_lambda' — { accessKeyId, secretAccessKey, region }
 *
 * Real SigV4 via `@aws-sdk/client-lambda`. The SDK signs requests internally.
 *
 * Actions:
 *   - invoke          InvokeCommand by function name (RequestResponse/Event/DryRun)
 *   - list_functions  ListFunctionsCommand → [{ name, runtime, arn }]
 */

import {
  InvokeCommand,
  LambdaClient,
  ListFunctionsCommand,
} from '@aws-sdk/client-lambda';
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString, requireCredential } from '../_shared/http';

type LambdaCred = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

function credFor(ctx: ForgeActionContext): LambdaCred {
  const raw = requireCredential('AWS Lambda', ctx.credential);
  const accessKeyId = asString(raw.accessKeyId);
  const secretAccessKey = asString(raw.secretAccessKey);
  const region = asString(raw.region);
  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error('AWS Lambda: credential must include accessKeyId, secretAccessKey, region');
  }
  return { accessKeyId, secretAccessKey, region };
}

function clientFor(ctx: ForgeActionContext): LambdaClient {
  const cred = credFor(ctx);
  return new LambdaClient({
    region: cred.region,
    credentials: { accessKeyId: cred.accessKeyId, secretAccessKey: cred.secretAccessKey },
  });
}

const VALID_INVOCATION_TYPES = new Set(['RequestResponse', 'Event', 'DryRun']);

async function invoke(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const client = clientFor(ctx);
  const functionName = asString(ctx.options.functionName);
  if (!functionName) throw new Error('AWS Lambda: functionName is required');

  const payloadRaw = asString(ctx.options.payload);
  let payloadBytes: Uint8Array | undefined;
  if (payloadRaw) {
    try {
      // Validate JSON before sending so we surface a nice error.
      JSON.parse(payloadRaw);
    } catch {
      throw new Error('AWS Lambda: payload must be valid JSON');
    }
    payloadBytes = new TextEncoder().encode(payloadRaw);
  }

  const invocationTypeRaw = asString(ctx.options.invocationType) || 'RequestResponse';
  if (!VALID_INVOCATION_TYPES.has(invocationTypeRaw)) {
    throw new Error(`AWS Lambda: unsupported invocationType "${invocationTypeRaw}"`);
  }
  const invocationType = invocationTypeRaw as 'RequestResponse' | 'Event' | 'DryRun';

  const qualifier = asString(ctx.options.qualifier) || undefined;

  const res = await client.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: invocationType,
      Payload: payloadBytes,
      Qualifier: qualifier,
    }),
  );

  let parsed: unknown = null;
  if (res.Payload) {
    const text = new TextDecoder().decode(res.Payload);
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
  }

  if (res.FunctionError) {
    throw new Error(
      `AWS Lambda: ${functionName} returned ${res.FunctionError} — ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`,
    );
  }

  return {
    outputs: {
      statusCode: res.StatusCode ?? null,
      payload: parsed,
      executedVersion: res.ExecutedVersion ?? null,
    },
    logs: [`AWS Lambda invoke ${functionName}${qualifier ? `:${qualifier}` : ''} → ${res.StatusCode}`],
  };
}

async function listFunctions(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const client = clientFor(ctx);
  const res = await client.send(new ListFunctionsCommand({}));
  const functions = (res.Functions ?? []).map((f) => ({
    name: f.FunctionName ?? null,
    runtime: f.Runtime ?? null,
    arn: f.FunctionArn ?? null,
  }));
  return {
    outputs: { count: functions.length, functions },
    logs: [`AWS Lambda list → ${functions.length} function(s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_aws_lambda',
  name: 'AWS Lambda',
  description: 'Invoke and list AWS Lambda functions (SigV4 via AWS SDK v3).',
  iconName: 'LuFunctionSquare',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'aws_lambda' },
  actions: [
    {
      id: 'invoke',
      label: 'Invoke function',
      description: 'Invoke a Lambda by name with an optional JSON payload.',
      fields: [
        { id: 'functionName', label: 'Function name', type: 'text', required: true },
        { id: 'payload', label: 'Payload (JSON)', type: 'json', placeholder: '{"key":"value"}' },
        {
          id: 'invocationType',
          label: 'Invocation type',
          type: 'select',
          defaultValue: 'RequestResponse',
          options: [
            { label: 'RequestResponse (synchronous)', value: 'RequestResponse' },
            { label: 'Event (async, fire & forget)', value: 'Event' },
            { label: 'DryRun (validate only)', value: 'DryRun' },
          ],
        },
        { id: 'qualifier', label: 'Qualifier (alias or version)', type: 'text', placeholder: '$LATEST | prod | 7' },
      ],
      run: invoke,
    },
    {
      id: 'list_functions',
      label: 'List functions',
      description: 'Return all Lambda functions in the credential region.',
      fields: [],
      run: listFunctions,
    },
  ],
};

registerForgeBlock(block);
export default block;
