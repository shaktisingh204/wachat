/**
 * Forge block: Currency Convert
 *
 * Convert an amount between two ISO-4217 currencies using the public
 * Frankfurter API (https://www.frankfurter.app). No auth required. The API
 * publishes ECB reference rates updated daily.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

type FrankfurterResponse = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

const block: ForgeBlock = {
  id: 'forge_currency_convert',
  name: 'Currency: Convert',
  description: 'Convert an amount between currencies (Frankfurter, no auth).',
  iconName: 'LuBanknote',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'convert',
      label: 'Convert',
      fields: [
        { id: 'amount', label: 'Amount', type: 'number', required: true, defaultValue: 1 },
        { id: 'from', label: 'From currency', type: 'text', required: true, placeholder: 'USD' },
        { id: 'to', label: 'To currency', type: 'text', required: true, placeholder: 'EUR' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const amount = asNumber(ctx.options.amount) ?? 1;
        const from = asString(ctx.options.from).toUpperCase();
        const to = asString(ctx.options.to).toUpperCase();
        if (!from || !to) throw new Error('Currency: from/to are required');

        const url = `https://api.frankfurter.app/latest?amount=${encodeURIComponent(String(amount))}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
        const res = await apiRequest({ service: 'Frankfurter', method: 'GET', url });
        const data = res.data as FrankfurterResponse;
        const converted = data?.rates?.[to];
        if (typeof converted !== 'number') {
          throw new Error(`Currency: missing rate for ${to} in response`);
        }
        return {
          outputs: {
            amount,
            from,
            to,
            converted,
            rate: converted / amount,
            date: data.date,
          },
          logs: [`${amount} ${from} → ${converted} ${to}`],
        };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
