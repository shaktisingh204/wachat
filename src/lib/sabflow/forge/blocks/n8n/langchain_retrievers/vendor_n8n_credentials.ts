/**
 * Forge block: SabFlow Credentials (n8n vendor port)
 *
 * Source: n8n-master/packages/@n8n/nodes-base/nodes/N8n/N8nCredential.node.ts
 *
 * Lists the calling workspace's stored SabFlow credentials matching a given
 * type filter. The actual secret material (`data` map) is NEVER returned —
 * only metadata (id, type, name, createdAt, updatedAt) so downstream blocks
 * or LLM agents can offer a "pick a connection" UX without leaking keys.
 *
 * Workspace scoping: forge actions now receive `ctx.userId` (the workspace
 * owner) which maps directly onto `Credential.workspaceId` in the
 * `sabflow_credentials` collection.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

async function listCredentials(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const credentialType = asString(ctx.options.credential_type).trim();
  if (!credentialType) throw new Error('SabFlowCredentials: credential_type is required');
  if (!ctx.userId) {
    throw new Error(
      'SabFlowCredentials: caller userId is missing — credential listing requires authenticated context.',
    );
  }

  // Late import: the credentials DB module pulls Mongo + the encryption layer
  // (server-only). Keeping it lazy means the block descriptor stays cheap to
  // import from the metadata API.
  const { getCredentials } = await import('@/lib/sabflow/credentials/db');
  // The CredentialType union is enforced at the DB layer — casting here keeps
  // the field flexible (we accept any string and let getCredentials filter).
  const records = await getCredentials(
    ctx.userId,
    credentialType as Parameters<typeof getCredentials>[1],
  );

  // Project to safe metadata — never include `data` (it's decrypted in-memory
  // and must not leak into a downstream block's variable map).
  const credentials = records.map((c) => ({
    id: c.id,
    type: c.type,
    name: c.name,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return {
    outputs: {
      credentials,
      credential_type: credentialType,
      count: credentials.length,
    },
    logs: [
      `SabFlowCredentials → ${credentials.length} credential(s) of type "${credentialType}"`,
    ],
  };
}

const block: ForgeBlock = {
  id: 'forge_vendor_n8n_credentials',
  name: 'SabFlow Credentials (info)',
  description: 'List the workspace credentials of a given provider type (metadata only — secrets stay encrypted).',
  iconName: 'LuKeyRound',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'list',
      label: 'List credentials',
      description: 'Return workspace credentials matching the requested provider type.',
      fields: [
        {
          id: 'credential_type',
          label: 'Credential type',
          type: 'text',
          required: true,
          placeholder: 'openai | slack | postgres | …',
          helperText: 'Provider id from the SabFlow Connections list.',
        },
      ],
      run: listCredentials,
    },
  ],
};

registerForgeBlock(block);
export default block;
