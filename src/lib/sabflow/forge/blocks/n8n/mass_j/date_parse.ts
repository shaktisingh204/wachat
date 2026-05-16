/**
 * Forge block: Date Parse
 *
 * Parse an arbitrary date string via the JavaScript Date constructor and emit
 * the normalised ISO + epoch values. Throws when the input is not a
 * recognisable date so flow authors see an explicit failure.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const block: ForgeBlock = {
  id: 'forge_date_parse',
  name: 'Date: Parse',
  description: 'Parse a date string into ISO + epoch.',
  iconName: 'LuCalendar',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'parse',
      label: 'Parse',
      fields: [{ id: 'input', label: 'Date string', type: 'text', required: true, placeholder: '2026-05-17T10:00:00Z' }],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const input = asString(ctx.options.input);
        const d = new Date(input);
        if (Number.isNaN(d.getTime())) {
          throw new Error(`Date parse failed: "${input}" is not a recognisable date`);
        }
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
