/**
 * Forge block: Number — Format.
 * Pure-JS transform: format a number with decimals, as currency, or as percent.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString } from '../_shared/http';

type Style = 'decimal' | 'currency' | 'percent';

const block: ForgeBlock = {
  id: 'forge_number_format',
  name: 'Number: Format',
  description: 'Format a number using Intl: decimals, currency, or percent.',
  iconName: 'LuHash',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'format',
      label: 'Format',
      description: 'Render a number with locale-aware formatting.',
      fields: [
        { id: 'input', label: 'Number', type: 'number', required: true },
        {
          id: 'style',
          label: 'Style',
          type: 'select',
          defaultValue: 'decimal',
          options: [
            { label: 'Decimal', value: 'decimal' },
            { label: 'Currency', value: 'currency' },
            { label: 'Percent', value: 'percent' },
          ],
        },
        { id: 'locale', label: 'Locale', type: 'text', defaultValue: 'en-US', placeholder: 'en-US' },
        { id: 'currency', label: 'Currency code', type: 'text', defaultValue: 'USD', placeholder: 'USD', showIf: { field: 'style', equals: 'currency' } },
        { id: 'minimumFractionDigits', label: 'Min decimals', type: 'number' },
        { id: 'maximumFractionDigits', label: 'Max decimals', type: 'number' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const n = asNumber(ctx.options.input);
        if (n === undefined) throw new Error('Number: Format — input is not a valid number');
        const style = (asString(ctx.options.style) || 'decimal') as Style;
        const locale = asString(ctx.options.locale) || 'en-US';
        const currency = asString(ctx.options.currency) || 'USD';
        const min = asNumber(ctx.options.minimumFractionDigits);
        const max = asNumber(ctx.options.maximumFractionDigits);

        const opts: Intl.NumberFormatOptions = { style };
        if (style === 'currency') opts.currency = currency;
        if (min !== undefined) opts.minimumFractionDigits = min;
        if (max !== undefined) opts.maximumFractionDigits = max;

        const result = new Intl.NumberFormat(locale, opts).format(n);
        return { outputs: { result } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
