/**
 * Forge block: Regex — Match.
 * Pure-JS transform: runs a regex against the input and returns matches.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asBoolean, asString } from '../_shared/http';

const block: ForgeBlock = {
  id: 'forge_regex_match',
  name: 'Regex: Match',
  description: 'Match a regex against a string and return the matches.',
  iconName: 'LuRegex',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'match',
      label: 'Match',
      description: 'Return the matches of a regex against the input.',
      fields: [
        { id: 'input', label: 'Input', type: 'text', required: true },
        { id: 'pattern', label: 'Pattern', type: 'text', required: true, placeholder: '\\d+' },
        { id: 'flags', label: 'Flags', type: 'text', defaultValue: 'g', placeholder: 'g, gi, gim' },
        { id: 'matchAll', label: 'Return all matches', type: 'toggle', defaultValue: true },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const input = asString(ctx.options.input);
        const pattern = asString(ctx.options.pattern);
        const flags = asString(ctx.options.flags) || '';
        const matchAll = asBoolean(ctx.options.matchAll);
        if (!pattern) throw new Error('Regex: Match — pattern is required');

        if (matchAll) {
          const re = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`);
          const matches = Array.from(input.matchAll(re)).map((m) => ({
            match: m[0],
            groups: m.slice(1),
            index: m.index ?? -1,
          }));
          return { outputs: { matches, count: matches.length } };
        }

        const re = new RegExp(pattern, flags);
        const m = input.match(re);
        if (!m) return { outputs: { match: null, matches: [], count: 0 } };
        return {
          outputs: {
            match: m[0],
            groups: m.slice(1),
            index: m.index ?? -1,
            matches: [{ match: m[0], groups: m.slice(1), index: m.index ?? -1 }],
            count: 1,
          },
        };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
