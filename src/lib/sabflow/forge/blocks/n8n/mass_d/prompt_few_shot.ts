/**
 * Forge block: Few-Shot Prompt
 *
 * Assemble a few-shot prompt from a list of example {input, output} pairs +
 * a prefix and a suffix that contains the actual user input. Mirrors
 * LangChain's `FewShotPromptTemplate`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

type Example = { input: string; output: string };

function toExamples(v: unknown): Example[] {
  if (Array.isArray(v)) {
    return v
      .map((e) => {
        if (!e || typeof e !== 'object') return null;
        const o = e as Record<string, unknown>;
        return { input: asString(o.input), output: asString(o.output) };
      })
      .filter((e): e is Example => !!e && !!e.input && !!e.output);
  }
  if (typeof v === 'string' && v.trim()) {
    try {
      const parsed = JSON.parse(v);
      return toExamples(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

function fillTemplate(t: string, vars: Record<string, string>): string {
  return t.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? '');
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const prefix = asString(ctx.options.prefix);
  const suffix = asString(ctx.options.suffix) || 'Input: {{input}}\nOutput:';
  const exampleTemplate = asString(ctx.options.exampleTemplate) || 'Input: {{input}}\nOutput: {{output}}';
  const separator = asString(ctx.options.separator) || '\n\n';
  const input = asString(ctx.options.input);
  if (!input) throw new Error('Few-Shot Prompt: input is required');
  const examples = toExamples(ctx.options.examples);
  if (examples.length === 0) throw new Error('Few-Shot Prompt: at least one example required');

  const rendered = examples.map((e) => fillTemplate(exampleTemplate, e)).join(separator);
  const tail = fillTemplate(suffix, { input });
  const text = [prefix, rendered, tail].filter(Boolean).join(separator);
  return { outputs: { text, exampleCount: examples.length }, logs: [`Few-Shot → ${examples.length} example(s)`] };
}

const block: ForgeBlock = {
  id: 'forge_prompt_few_shot',
  name: 'Few-Shot Prompt',
  description: 'Compose a few-shot prompt: prefix + N example pairs + suffix containing the new input.',
  iconName: 'LuListOrdered',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'render',
      label: 'Assemble prompt',
      fields: [
        { id: 'prefix', label: 'Prefix (instructions)', type: 'textarea' },
        {
          id: 'examples',
          label: 'Examples (JSON array of {input, output})',
          type: 'json',
          required: true,
        },
        {
          id: 'exampleTemplate',
          label: 'Per-example template',
          type: 'textarea',
          defaultValue: 'Input: {{input}}\nOutput: {{output}}',
        },
        {
          id: 'suffix',
          label: 'Suffix template (uses {{input}})',
          type: 'textarea',
          defaultValue: 'Input: {{input}}\nOutput:',
        },
        { id: 'separator', label: 'Separator', type: 'text', defaultValue: '\\n\\n' },
        { id: 'input', label: 'Actual user input', type: 'textarea', required: true },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
