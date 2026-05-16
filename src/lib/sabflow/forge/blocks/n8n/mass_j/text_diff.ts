/**
 * Forge block: Text Diff
 *
 * Naive line-by-line diff between two strings. Each output line is prefixed
 * with " " (unchanged), "+" (added in B) or "-" (removed from A) — good
 * enough for change-summary use cases without bundling a full LCS algorithm.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

function lineDiff(a: string, b: string): { diff: string; added: number; removed: number } {
  const linesA = a.split(/\r?\n/);
  const linesB = b.split(/\r?\n/);
  const setA = new Set(linesA);
  const setB = new Set(linesB);
  const out: string[] = [];
  let added = 0;
  let removed = 0;

  const max = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < max; i++) {
    const la = linesA[i];
    const lb = linesB[i];
    if (la === lb) {
      if (la !== undefined) out.push(`  ${la}`);
    } else {
      if (la !== undefined && !setB.has(la)) {
        out.push(`- ${la}`);
        removed++;
      }
      if (lb !== undefined && !setA.has(lb)) {
        out.push(`+ ${lb}`);
        added++;
      }
    }
  }

  return { diff: out.join('\n'), added, removed };
}

const block: ForgeBlock = {
  id: 'forge_text_diff',
  name: 'Text: Diff',
  description: 'Naive line-by-line diff between two strings.',
  iconName: 'LuGitCompare',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'diff',
      label: 'Diff',
      fields: [
        { id: 'left', label: 'Original (A)', type: 'textarea', required: true },
        { id: 'right', label: 'Updated (B)', type: 'textarea', required: true },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const a = asString(ctx.options.left);
        const b = asString(ctx.options.right);
        const { diff, added, removed } = lineDiff(a, b);
        return {
          outputs: { diff, added, removed, changed: added > 0 || removed > 0 },
          logs: [`Diff: +${added} -${removed}`],
        };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
