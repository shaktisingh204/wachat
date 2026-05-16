/**
 * Forge block: SabFlow Credentials (n8n vendor stub)
 *
 * Source: n8n-master/packages/@n8n/nodes-base/nodes/N8n/N8nCredential.node.ts
 *
 * Info-only stub. n8n's own "Credentials" node lists credentials of a given
 * type from the host instance. We surface the type filter so flows can later
 * resolve a list of matching SabFlow connections — for now we just return the
 * requested type as a single-element list with a stub flag.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

async function listCredentials(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const credentialType = asString(ctx.options.credential_type);
  if (!credentialType) throw new Error('SabFlowCredentials: credential_type is required');
  return {
    outputs: {
      credentials: [],
      credential_type: credentialType,
      note: 'stub — wire to SabFlow connections registry',
    },
    logs: [`SabFlowCredentials stub → type ${credentialType}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_vendor_n8n_credentials',
  name: 'SabFlow Credentials (info)',
  description: 'Info-only: list user credentials matching a type (stub).',
  iconName: 'LuKeyRound',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'list',
      label: 'List credentials',
      description: 'Return user credentials matching the requested type (stub).',
      fields: [
        { id: 'credential_type', label: 'Credential type', type: 'text', required: true },
      ],
      run: listCredentials,
    },
  ],
};

registerForgeBlock(block);
export default block;
