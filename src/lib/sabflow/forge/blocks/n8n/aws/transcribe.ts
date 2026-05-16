/**
 * Forge block: AWS Transcribe
 *
 * Source: n8n-master/packages/nodes-base/nodes/Aws/Transcribe/AwsTranscribe.node.ts
 *
 * Dynamic-imports `@aws-sdk/client-transcribe`.
 *
 * Actions: start-transcription-job, get-transcription-job, list-transcription-jobs.
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
    throw new Error('AWS Transcribe: accessKeyId, secretAccessKey and region are required');
  }
  return { accessKeyId, secretAccessKey, region };
}

type SdkClient = {
  send: (cmd: unknown) => Promise<Record<string, unknown>>;
  destroy?: () => void;
};

type TranscribeSdk = Record<string, unknown> & {
  TranscribeClient: new (cfg: Record<string, unknown>) => SdkClient;
};

async function loadSdk(): Promise<TranscribeSdk> {
  try {
    const mod = (await import('@aws-sdk/client-transcribe' as string)) as Record<string, unknown>;
    const real = ((mod as { default?: Record<string, unknown> }).default ?? mod) as TranscribeSdk;
    if (typeof real.TranscribeClient !== 'function') throw new Error('TranscribeClient missing');
    return real;
  } catch {
    throw new Error("AWS Transcribe: install '@aws-sdk/client-transcribe' to use this block");
  }
}

function clientFor(cred: AwsCred, sdk: TranscribeSdk): SdkClient {
  return new sdk.TranscribeClient({
    region: cred.region,
    credentials: { accessKeyId: cred.accessKeyId, secretAccessKey: cred.secretAccessKey },
  });
}

async function runCommand(sdk: TranscribeSdk, cmdName: string, input: Record<string, unknown>, cred: AwsCred): Promise<Record<string, unknown>> {
  const Ctor = sdk[cmdName] as undefined | (new (i: Record<string, unknown>) => unknown);
  if (typeof Ctor !== 'function') {
    throw new Error(`AWS Transcribe: ${cmdName} not available in SDK`);
  }
  const client = clientFor(cred, sdk);
  try {
    return await client.send(new Ctor(input));
  } finally {
    client.destroy?.();
  }
}

async function startTranscriptionJob(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const TranscriptionJobName = asString(ctx.options.transcriptionJobName);
  const MediaFileUri = asString(ctx.options.mediaFileUri);
  if (!TranscriptionJobName) throw new Error('AWS Transcribe: transcriptionJobName is required');
  if (!MediaFileUri) throw new Error('AWS Transcribe: mediaFileUri is required (s3://bucket/key)');
  const LanguageCode = asString(ctx.options.languageCode) || undefined;
  const MediaFormat = asString(ctx.options.mediaFormat) || undefined;
  const OutputBucketName = asString(ctx.options.outputBucketName) || undefined;
  const IdentifyLanguage = asString(ctx.options.identifyLanguage).toLowerCase() === 'true' || undefined;
  const input: Record<string, unknown> = {
    TranscriptionJobName,
    Media: { MediaFileUri },
  };
  if (LanguageCode) input.LanguageCode = LanguageCode;
  if (MediaFormat) input.MediaFormat = MediaFormat;
  if (OutputBucketName) input.OutputBucketName = OutputBucketName;
  if (IdentifyLanguage) input.IdentifyLanguage = true;
  if (!LanguageCode && !IdentifyLanguage) {
    throw new Error('AWS Transcribe: provide languageCode or set identifyLanguage = true');
  }
  const res = await runCommand(sdk, 'StartTranscriptionJobCommand', input, cred);
  return {
    outputs: { transcriptionJob: res.TranscriptionJob ?? null },
    logs: [`Transcribe StartTranscriptionJob ${TranscriptionJobName}`],
  };
}

async function getTranscriptionJob(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const TranscriptionJobName = asString(ctx.options.transcriptionJobName);
  if (!TranscriptionJobName) throw new Error('AWS Transcribe: transcriptionJobName is required');
  const res = await runCommand(sdk, 'GetTranscriptionJobCommand', { TranscriptionJobName }, cred);
  const job = (res.TranscriptionJob as Record<string, unknown> | null | undefined) ?? null;
  return {
    outputs: {
      transcriptionJob: job,
      status: job ? (job.TranscriptionJobStatus ?? null) : null,
    },
    logs: [`Transcribe GetTranscriptionJob ${TranscriptionJobName} → ${asString(job?.TranscriptionJobStatus) || 'n/a'}`],
  };
}

async function listTranscriptionJobs(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const Status = asString(ctx.options.status) || undefined;
  const JobNameContains = asString(ctx.options.jobNameContains) || undefined;
  const MaxResults = asNumber(ctx.options.maxResults);
  const NextToken = asString(ctx.options.nextToken) || undefined;
  const input: Record<string, unknown> = {};
  if (Status) input.Status = Status;
  if (JobNameContains) input.JobNameContains = JobNameContains;
  if (MaxResults !== undefined) input.MaxResults = MaxResults;
  if (NextToken) input.NextToken = NextToken;
  const res = await runCommand(sdk, 'ListTranscriptionJobsCommand', input, cred);
  const summaries = (res.TranscriptionJobSummaries as unknown[] | undefined) ?? [];
  return {
    outputs: {
      transcriptionJobSummaries: summaries,
      status: res.Status ?? null,
      nextToken: res.NextToken ?? null,
    },
    logs: [`Transcribe ListTranscriptionJobs → ${summaries.length} job(s)`],
  };
}

const CRED_FIELDS: ForgeField[] = [
  { id: 'accessKeyId', label: 'Access key id', type: 'password', required: true },
  { id: 'secretAccessKey', label: 'Secret access key', type: 'password', required: true },
  { id: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-east-1' },
];

const block: ForgeBlock = {
  id: 'forge_aws_transcribe',
  name: 'AWS Transcribe',
  description: 'Run speech-to-text transcription jobs on audio in S3.',
  iconName: 'LuMic',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'start_transcription_job',
      label: 'Start transcription job',
      description: 'StartTranscriptionJob against an S3 media URI.',
      fields: [
        ...CRED_FIELDS,
        { id: 'transcriptionJobName', label: 'Job name', type: 'text', required: true },
        { id: 'mediaFileUri', label: 'Media file URI', type: 'text', required: true, placeholder: 's3://bucket/audio.mp3' },
        { id: 'languageCode', label: 'Language code', type: 'text', placeholder: 'en-US' },
        { id: 'identifyLanguage', label: 'Identify language (true/false)', type: 'text' },
        { id: 'mediaFormat', label: 'Media format', type: 'text', placeholder: 'mp3 / mp4 / wav / flac' },
        { id: 'outputBucketName', label: 'Output S3 bucket', type: 'text' },
      ],
      run: startTranscriptionJob,
    },
    {
      id: 'get_transcription_job',
      label: 'Get transcription job',
      description: 'GetTranscriptionJob by name.',
      fields: [
        ...CRED_FIELDS,
        { id: 'transcriptionJobName', label: 'Job name', type: 'text', required: true },
      ],
      run: getTranscriptionJob,
    },
    {
      id: 'list_transcription_jobs',
      label: 'List transcription jobs',
      description: 'ListTranscriptionJobs with optional filters.',
      fields: [
        ...CRED_FIELDS,
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { label: 'Any', value: '' },
            { label: 'QUEUED', value: 'QUEUED' },
            { label: 'IN_PROGRESS', value: 'IN_PROGRESS' },
            { label: 'FAILED', value: 'FAILED' },
            { label: 'COMPLETED', value: 'COMPLETED' },
          ],
        },
        { id: 'jobNameContains', label: 'Job name contains', type: 'text' },
        { id: 'maxResults', label: 'Max results', type: 'number' },
        { id: 'nextToken', label: 'Next token', type: 'text' },
      ],
      run: listTranscriptionJobs,
    },
  ],
};

registerForgeBlock(block);
export default block;
