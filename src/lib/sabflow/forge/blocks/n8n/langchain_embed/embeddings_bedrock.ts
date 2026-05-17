/**
 * Forge block: Embeddings AWS Bedrock
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/embeddings/EmbeddingsAwsBedrock
 *
 * Endpoint:
 *   POST https://bedrock-runtime.<region>.amazonaws.com/model/<model-id>/invoke
 *   Auth: AWS SigV4 (service="bedrock", body-signed)
 *
 * Request body branches on the model family:
 *   - amazon.titan-embed-*   → { inputText: "..." }                  (single string)
 *   - cohere.embed-*         → { texts: [...], input_type: "..." }   (array)
 *
 * Response shapes are normalised to `{ vectors: number[][], dimensions, raw }`.
 *
 * Credentials are inline (matches sibling LM/embed blocks like
 * `embeddings_openai.ts`).  No `@aws-sdk/*` packages are pulled in — the
 * SigV4 signer at `forge/aws/sigv4.ts` does the heavy lifting.
 */

import { signV4 } from '../../../aws/sigv4';
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function parseInput(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    return [String(parsed)];
  } catch {
    return [raw];
  }
}

/**
 * Path segments containing `:` (e.g. `amazon.titan-embed-text-v2:0`) must be
 * percent-encoded before being signed — Bedrock returns 403 otherwise because
 * the canonical URI in the signature wouldn't match what the server computes.
 */
function bedrockInvokeUrl(region: string, modelId: string): string {
  return `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/invoke`;
}

function buildPayload(modelId: string, texts: string[], inputType: string): {
  body: unknown;
  isCohere: boolean;
} {
  if (modelId.startsWith('cohere.')) {
    return {
      body: {
        texts,
        input_type: inputType || 'search_document',
      },
      isCohere: true,
    };
  }
  // Titan family — single-string per call.  When the caller passes multiple
  // texts we batch them with Promise.all below, so this only ever sees one.
  return {
    body: { inputText: texts[0] ?? '' },
    isCohere: false,
  };
}

type EmbedResponseTitan = { embedding?: number[] };
type EmbedResponseCohere = { embeddings?: number[][] | { float?: number[][] } };

function extractVectors(modelId: string, raw: unknown): number[][] {
  if (modelId.startsWith('cohere.')) {
    const body = raw as EmbedResponseCohere;
    if (Array.isArray(body?.embeddings)) return body.embeddings;
    const float = body?.embeddings && !Array.isArray(body.embeddings) ? body.embeddings.float : undefined;
    return Array.isArray(float) ? float : [];
  }
  const body = raw as EmbedResponseTitan;
  return Array.isArray(body?.embedding) ? [body.embedding] : [];
}

async function embedOne(args: {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  modelId: string;
  texts: string[];
  inputType: string;
}): Promise<{ vectors: number[][]; raw: unknown }> {
  const { body } = buildPayload(args.modelId, args.texts, args.inputType);
  const bodyJson = JSON.stringify(body);
  const url = bedrockInvokeUrl(args.region, args.modelId);

  const signed = signV4({
    accessKeyId: args.accessKeyId,
    secretAccessKey: args.secretAccessKey,
    sessionToken: args.sessionToken,
    region: args.region,
    service: 'bedrock',
    method: 'POST',
    url,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: bodyJson,
  });

  const res = await apiRequest({
    service: 'Embeddings Bedrock',
    method: 'POST',
    url,
    headers: signed.headers,
    body: bodyJson,
  });
  return { vectors: extractVectors(args.modelId, res.data), raw: res.data };
}

async function embed(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessKeyId = asString(ctx.options.accessKeyId);
  const secretAccessKey = asString(ctx.options.secretAccessKey);
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Embeddings Bedrock: accessKeyId and secretAccessKey are required');
  }
  const sessionToken = asString(ctx.options.sessionToken) || undefined;
  const region = asString(ctx.options.region) || 'us-east-1';
  const modelId = asString(ctx.options.model) || 'amazon.titan-embed-text-v2:0';
  const inputType = asString(ctx.options.inputType) || 'search_document';
  const texts = parseInput(asString(ctx.options.input));
  if (texts.length === 0) throw new Error('Embeddings Bedrock: input is required');

  let vectors: number[][] = [];
  let lastRaw: unknown = null;

  if (modelId.startsWith('cohere.')) {
    // Cohere accepts a batch in one call.
    const out = await embedOne({
      accessKeyId,
      secretAccessKey,
      sessionToken,
      region,
      modelId,
      texts,
      inputType,
    });
    vectors = out.vectors;
    lastRaw = out.raw;
  } else {
    // Titan: one HTTP call per text — the model has no batch endpoint.
    const results = await Promise.all(
      texts.map((t) =>
        embedOne({
          accessKeyId,
          secretAccessKey,
          sessionToken,
          region,
          modelId,
          texts: [t],
          inputType,
        }),
      ),
    );
    vectors = results.flatMap((r) => r.vectors);
    lastRaw = results[results.length - 1]?.raw ?? null;
  }

  return {
    outputs: {
      // Match the sibling-block surface: vectors[] is the canonical name.
      // Also expose `embedding` for single-input convenience.
      vectors,
      embedding: vectors[0] ?? [],
      dimensions: vectors[0]?.length ?? 0,
      raw: lastRaw,
    },
    logs: [`Embeddings Bedrock → ${modelId} (${vectors.length})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_embeddings_bedrock',
  name: 'Embeddings AWS Bedrock',
  description: 'Generate embeddings via AWS Bedrock (SigV4-signed invoke).',
  iconName: 'LuSparkles',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'embed',
      label: 'Create embeddings',
      description: 'Embed text(s) with a Bedrock model (Titan or Cohere family).',
      fields: [
        { id: 'accessKeyId', label: 'AWS access key id', type: 'password', required: true },
        { id: 'secretAccessKey', label: 'AWS secret access key', type: 'password', required: true },
        { id: 'sessionToken', label: 'AWS session token (optional)', type: 'password' },
        { id: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1', required: true },
        { id: 'model', label: 'Model id', type: 'text', placeholder: 'amazon.titan-embed-text-v2:0' },
        {
          id: 'inputType',
          label: 'Input type (Cohere only)',
          type: 'select',
          options: [
            { label: 'search_document', value: 'search_document' },
            { label: 'search_query', value: 'search_query' },
            { label: 'classification', value: 'classification' },
            { label: 'clustering', value: 'clustering' },
          ],
          defaultValue: 'search_document',
        },
        {
          id: 'input',
          label: 'Input (string or JSON array of strings)',
          type: 'textarea',
          required: true,
        },
      ],
      run: embed,
    },
  ],
};

registerForgeBlock(block);
export default block;
