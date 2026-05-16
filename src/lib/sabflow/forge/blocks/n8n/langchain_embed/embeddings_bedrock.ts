/**
 * Forge block: Embeddings AWS Bedrock (stub)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/embeddings/EmbeddingsAwsBedrock
 *
 * Bedrock's InvokeModel endpoint requires AWS SigV4 request signing which is
 * non-trivial to reproduce in fetch without the AWS SDK. Until we install
 * `@aws-sdk/client-bedrock-runtime` this block exists as a registered stub so
 * flows can reference it; calling it throws an actionable install hint.
 *
 * `auth: { type: 'none' }`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

async function embed(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  throw new Error(
    'Embeddings AWS Bedrock: not yet implemented — install ' +
      '`@aws-sdk/client-bedrock-runtime` and wire up the SigV4 signer ' +
      'before enabling this block.',
  );
}

const block: ForgeBlock = {
  id: 'forge_embeddings_bedrock',
  name: 'Embeddings AWS Bedrock',
  description: 'Generate embeddings via AWS Bedrock (requires @aws-sdk/client-bedrock-runtime).',
  iconName: 'LuSparkles',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'embed',
      label: 'Create embeddings',
      description: 'Stub — install @aws-sdk/client-bedrock-runtime to enable.',
      fields: [
        { id: 'accessKeyId', label: 'AWS access key id', type: 'password', required: true },
        { id: 'secretAccessKey', label: 'AWS secret access key', type: 'password', required: true },
        { id: 'sessionToken', label: 'AWS session token (optional)', type: 'password' },
        { id: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1', required: true },
        { id: 'model', label: 'Model id', type: 'text', placeholder: 'amazon.titan-embed-text-v2:0' },
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
