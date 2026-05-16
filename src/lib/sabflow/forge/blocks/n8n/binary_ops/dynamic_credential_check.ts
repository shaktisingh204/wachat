/**
 * Forge block: Dynamic Credential Check
 *
 * Source: n8n-master/packages/nodes-base/nodes/DynamicCredentialCheck/DynamicCredentialCheck.node.ts
 *
 * Runtime sanity check that a credential id is present. A full validation
 * would resolve the credential via the SabFlow engine — left as a TODO so
 * the block stays side-effect-free in the SaaS runtime.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function verifyPresent(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const credentialId = asString(ctx.options.credentialId).trim();
  const present = credentialId.length > 0;
  return {
    outputs: { present, credentialId },
    logs: [`DynamicCredentialCheck verify_present → ${present ? 'ok' : 'missing'}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_dynamic_credential_check',
  name: 'Dynamic Credential Check',
  description: 'Sanity-check that a credential id is non-empty at runtime.',
  iconName: 'LuKey',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'verify_present',
      label: 'Verify credential present',
      description: 'Returns { present: true } when the credential id is non-empty.',
      fields: [
        { id: 'credentialId', label: 'Credential ID', type: 'text', required: true },
      ],
      run: verifyPresent,
    },
  ],
};

registerForgeBlock(block);
export default block;
