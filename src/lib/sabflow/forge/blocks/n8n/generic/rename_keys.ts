/**
 * Forge block: Rename Keys
 *
 * Source: n8n-master/packages/nodes-base/nodes/RenameKeys/RenameKeys.node.ts
 * Credential type: none — pure data transform.
 *
 * Operations covered:
 *   - rename       — rewrite top-level keys via { currentKey → newKey } pairs
 *   - rename_regex — replace matched substrings in every top-level key
 *                    according to a regex + replacement (n8n's `regexReplace`)
 *
 * Out of scope: dot-path nested renames — deferred. Use the Code block for
 * complex rewrites.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
  ForgeKeyValuePair,
} from '../../../types';
import { asString } from '../_shared/http';

function applyRenames<T extends Record<string, unknown>>(
  input: T,
  pairs: ForgeKeyValuePair[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  for (const pair of pairs) {
    const from = asString(pair.key);
    const to = asString(pair.value);
    if (!from || !to || from === to) continue;
    if (Object.prototype.hasOwnProperty.call(out, from)) {
      out[to] = out[from];
      delete out[from];
    }
  }
  return out;
}

function parseInput(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  const s = asString(raw).trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch (err) {
    throw new Error(`Rename Keys: invalid input JSON — ${(err as Error).message}`);
  }
}

function applyRegex<T extends Record<string, unknown>>(
  input: T,
  pattern: RegExp,
  replacement: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    const next = k.replace(pattern, replacement);
    // Preserve the original entry when the regex doesn't match — otherwise we
    // would silently drop keys that the user didn't intend to touch.
    out[next || k] = v;
  }
  return out;
}

async function renameRegex(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const input = parseInput(ctx.options.input);
  const pattern = asString(ctx.options.regex);
  const replacement = asString(ctx.options.replacement);
  const flags = asString(ctx.options.flags) || 'g';
  if (!pattern) throw new Error('Rename Keys: regex is required');

  let re: RegExp;
  try {
    re = new RegExp(pattern, flags);
  } catch (err) {
    throw new Error(`Rename Keys: invalid regex — ${(err as Error).message}`);
  }

  let result: unknown;
  if (Array.isArray(input)) {
    result = input.map((item) =>
      item && typeof item === 'object'
        ? applyRegex(item as Record<string, unknown>, re, replacement)
        : item,
    );
  } else if (input && typeof input === 'object') {
    result = applyRegex(input as Record<string, unknown>, re, replacement);
  } else {
    throw new Error('Rename Keys: input must be an object or an array of objects');
  }

  return {
    outputs: { result },
    logs: [`Rename Keys regex /${pattern}/${flags}`],
  };
}

async function rename(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const input = parseInput(ctx.options.input);
  const pairs = (ctx.options.renames as ForgeKeyValuePair[] | undefined) ?? [];
  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new Error('Rename Keys: at least one rename pair is required');
  }

  let result: unknown;
  if (Array.isArray(input)) {
    result = input.map((item) =>
      item && typeof item === 'object'
        ? applyRenames(item as Record<string, unknown>, pairs)
        : item,
    );
  } else if (input && typeof input === 'object') {
    result = applyRenames(input as Record<string, unknown>, pairs);
  } else {
    throw new Error('Rename Keys: input must be an object or an array of objects');
  }

  return {
    outputs: { result },
    logs: [`Rename Keys → ${pairs.length} mapping(s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_rename_keys',
  name: 'Rename Keys',
  description: 'Rewrite object keys according to a list of from→to mappings.',
  iconName: 'LuArrowLeftRight',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'rename',
      label: 'Rename keys',
      description: 'Each entry maps a current key (left) to a new key (right).',
      fields: [
        {
          id: 'input',
          label: 'Input (object or array of objects)',
          type: 'json',
          required: true,
        },
        {
          id: 'renames',
          label: 'Renames (current → new)',
          type: 'key-value-list',
          helperText: 'Key column is the current name. Value column is the new name.',
        },
      ],
      run: rename,
    },
    {
      id: 'rename_regex',
      label: 'Rename keys (regex)',
      description: 'Replace matching substrings inside every top-level key.',
      fields: [
        {
          id: 'input',
          label: 'Input (object or array of objects)',
          type: 'json',
          required: true,
        },
        {
          id: 'regex',
          label: 'Regex pattern',
          type: 'text',
          required: true,
          placeholder: '^old_',
        },
        {
          id: 'replacement',
          label: 'Replacement',
          type: 'text',
          placeholder: 'new_',
        },
        {
          id: 'flags',
          label: 'Regex flags',
          type: 'text',
          defaultValue: 'g',
          helperText: 'Defaults to "g". Add "i" for case-insensitive.',
        },
      ],
      run: renameRegex,
    },
  ],
};

registerForgeBlock(block);
export default block;
