/**
 * Forge block: Date Now
 *
 * Emit the current wall-clock time in both ISO 8601 and Unix epoch (ms / s)
 * formats — saves flow authors from chaining a separate Set + math block.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';

const block: ForgeBlock = {
  id: 'forge_date_now',
  name: 'Date: Now',
  description: 'Return the current timestamp as ISO + epoch.',
  iconName: 'LuClock',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'now',
      label: 'Now',
      fields: [],
      run: async (_ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const d = new Date();
        return {
          outputs: {
            iso: d.toISOString(),
            epoch_ms: d.getTime(),
            epoch_s: Math.floor(d.getTime() / 1000),
          },
        };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
