/**
 * Forge block: Number — Round.
 * Pure-JS transform: round/floor/ceil to a given precision.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString } from '../_shared/http';

type Mode = 'round' | 'floor' | 'ceil';

const block: ForgeBlock = {
  id: 'forge_number_round',
  name: 'Number: Round',
  description: 'Round a number using round, floor, or ceil.',
  iconName: 'LuCalculator',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'round',
      label: 'Round',
      description: 'Round a number to a fixed number of decimal places.',
      fields: [
        { id: 'input', label: 'Number', type: 'number', required: true },
        {
          id: 'mode',
          label: 'Mode',
          type: 'select',
          defaultValue: 'round',
          options: [
            { label: 'Round (nearest)', value: 'round' },
            { label: 'Floor (down)', value: 'floor' },
            { label: 'Ceil (up)', value: 'ceil' },
          ],
        },
        { id: 'decimals', label: 'Decimal places', type: 'number', defaultValue: 0 },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const n = asNumber(ctx.options.input);
        if (n === undefined) throw new Error('Number: Round — input is not a valid number');
        const mode = (asString(ctx.options.mode) || 'round') as Mode;
        const decimals = Math.max(0, Math.floor(asNumber(ctx.options.decimals) ?? 0));
        const factor = Math.pow(10, decimals);
        const fn = mode === 'floor' ? Math.floor : mode === 'ceil' ? Math.ceil : Math.round;
        const result = fn(n * factor) / factor;
        return { outputs: { result } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
