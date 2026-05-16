/**
 * Forge block: Number — Arithmetic.
 * Pure-JS transform: add/subtract/multiply/divide two numbers.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString } from '../_shared/http';

type Op = 'add' | 'sub' | 'mul' | 'div' | 'mod' | 'pow';

const block: ForgeBlock = {
  id: 'forge_number_arithmetic',
  name: 'Number: Arithmetic',
  description: 'Perform basic arithmetic on two numbers.',
  iconName: 'LuCalculator',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'arithmetic',
      label: 'Arithmetic',
      description: 'Compute a + b, a - b, a * b, a / b, a % b, or a ** b.',
      fields: [
        { id: 'a', label: 'A', type: 'number', required: true },
        { id: 'b', label: 'B', type: 'number', required: true },
        {
          id: 'op',
          label: 'Operation',
          type: 'select',
          defaultValue: 'add',
          options: [
            { label: 'Add (+)', value: 'add' },
            { label: 'Subtract (−)', value: 'sub' },
            { label: 'Multiply (×)', value: 'mul' },
            { label: 'Divide (÷)', value: 'div' },
            { label: 'Modulo (%)', value: 'mod' },
            { label: 'Power (**)', value: 'pow' },
          ],
        },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const a = asNumber(ctx.options.a);
        const b = asNumber(ctx.options.b);
        if (a === undefined || b === undefined) throw new Error('Number: Arithmetic — both inputs must be numbers');
        const op = (asString(ctx.options.op) || 'add') as Op;
        let result: number;
        switch (op) {
          case 'add': result = a + b; break;
          case 'sub': result = a - b; break;
          case 'mul': result = a * b; break;
          case 'div':
            if (b === 0) throw new Error('Number: Arithmetic — division by zero');
            result = a / b; break;
          case 'mod':
            if (b === 0) throw new Error('Number: Arithmetic — modulo by zero');
            result = a % b; break;
          case 'pow': result = Math.pow(a, b); break;
          default: throw new Error(`Number: Arithmetic — unknown operation "${op}"`);
        }
        return { outputs: { result } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
