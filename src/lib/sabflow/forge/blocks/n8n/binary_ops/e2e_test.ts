/**
 * Forge block: E2E Test
 *
 * Source: n8n-master/packages/nodes-base/nodes/E2eTest/E2eTest.node.ts
 *
 * Developer-only utility — n8n uses this to assert state during integration
 * tests. Not for production flows. Records a description + expected value
 * and echoes them back so a test harness can verify the flow ran.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function noopAssertion(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const description = asString(ctx.options.description);
  const expectedRaw = ctx.options.expected;
  let expected: unknown = expectedRaw;
  if (typeof expectedRaw === 'string') {
    try {
      expected = JSON.parse(expectedRaw);
    } catch {
      expected = expectedRaw;
    }
  }
  return {
    outputs: {
      asserted: true,
      description,
      expected,
    },
    logs: [`E2eTest noop_assertion → ${description || '(no description)'}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_e2e_test',
  name: 'E2E Test',
  description: 'Developer-only no-op assertion for end-to-end flow tests. Not for production.',
  iconName: 'LuTestTube',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'noop_assertion',
      label: 'No-op assertion',
      description: 'Record an assertion description + expected payload.',
      fields: [
        { id: 'description', label: 'Description', type: 'text', required: true },
        { id: 'expected', label: 'Expected (JSON)', type: 'json' },
      ],
      run: noopAssertion,
    },
  ],
};

registerForgeBlock(block);
export default block;
