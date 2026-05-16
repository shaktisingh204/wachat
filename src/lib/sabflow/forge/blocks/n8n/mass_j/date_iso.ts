/**
 * Forge block: Date ISO
 *
 * Format a date (ISO string or epoch number) into ISO 8601. Useful when
 * piping output from a third-party API that returns Unix-second timestamps.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString } from '../_shared/http';

const block: ForgeBlock = {
  id: 'forge_date_iso',
  name: 'Date: ISO',
  description: 'Format a date as ISO 8601.',
  iconName: 'LuCalendar',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'iso',
      label: 'To ISO',
      fields: [
        { id: 'input', label: 'Date or epoch', type: 'text', required: true },
        {
          id: 'epochUnit',
          label: 'Epoch unit (if numeric)',
          type: 'select',
          defaultValue: 'ms',
          options: [
            { value: 'ms', label: 'Milliseconds' },
            { value: 's', label: 'Seconds' },
          ],
        },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const raw = ctx.options.input;
        const unit = asString(ctx.options.epochUnit) || 'ms';
        let d: Date;
        const maybeNum = asNumber(raw);
        if (typeof raw === 'number' || (maybeNum !== undefined && /^\d+$/.test(asString(raw).trim()))) {
          const n = maybeNum ?? 0;
          d = new Date(unit === 's' ? n * 1000 : n);
        } else {
          d = new Date(asString(raw));
        }
        if (Number.isNaN(d.getTime())) {
          throw new Error('Date ISO: invalid input');
        }
        return { outputs: { iso: d.toISOString() } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
