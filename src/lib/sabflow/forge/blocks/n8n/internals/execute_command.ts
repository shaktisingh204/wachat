/**
 * Forge block: Execute Command
 *
 * Source: n8n-master/packages/nodes-base/nodes/ExecuteCommand/ExecuteCommand.node.ts
 * Credential type: none.
 *
 * SECURITY-SENSITIVE.
 *
 * Runtime: RESTRICTED. Shell execution is intentionally disabled on the SabFlow
 * runtime — multi-tenant SaaS code paths must not spawn arbitrary processes.
 * Use a dedicated server-action behind admin RBAC, or contact ops to enable
 * this on an isolated worker. The SabFlow native equivalent is a custom
 * server action invoked via the HTTP block.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function execute(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const command = asString(ctx.options.command);
  if (!command) throw new Error('ExecuteCommand: command is required');
  throw new Error(
    'ExecuteCommand: shell execution is disabled on the SabFlow runtime for security reasons. ' +
      'Use a dedicated server-action or contact admin to enable.',
  );
}

const block: ForgeBlock = {
  id: 'forge_execute_command',
  name: 'Execute Command',
  description: 'Restricted — shell execution is disabled on the SabFlow runtime.',
  iconName: 'LuTerminal',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'execute',
      label: 'Execute command',
      description: 'Always throws — see block header for the security rationale.',
      fields: [
        {
          id: 'command',
          label: 'Command',
          type: 'text',
          required: true,
          placeholder: 'ls -la',
          helperText: 'DISABLED — this action always throws on the SabFlow runtime.',
        },
      ],
      run: execute,
    },
  ],
};

registerForgeBlock(block);
export default block;
