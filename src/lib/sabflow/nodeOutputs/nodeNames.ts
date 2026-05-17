/**
 * Stable display-name assignment for blocks in a flow.
 *
 * n8n's convention: the node's display name is its type label, suffixed with
 * a numeric counter when duplicates exist within the same workflow
 * ("OpenAI", "OpenAI1", "OpenAI2").  We follow the same scheme so the tokens
 * emitted by the data picker match what users see elsewhere in the editor.
 *
 * Block ids are cuids and unsuitable for `$node["..."]` references, so this
 * module is the single source of truth for translating between the two.
 */

import type { Block, Group } from '@/lib/sabflow/types';
import { getBlockLabel } from '@/lib/sabflow/blocks';

/**
 * Returns a map of `blockId → displayName` for every block in the flow.
 *
 * Ordering is deterministic: blocks are visited group-by-group (in group
 * order) and within each group in declaration order, so renames are stable
 * across renders provided block ids don't change.
 */
export function buildBlockNameMap(groups: Group[]): Map<string, string> {
  const counts = new Map<string, number>();
  const result = new Map<string, string>();

  for (const group of groups) {
    for (const block of group.blocks) {
      const baseLabel = sanitiseLabel(getBlockLabel(block.type));
      const existing = counts.get(baseLabel) ?? 0;
      const displayName = existing === 0 ? baseLabel : `${baseLabel}${existing}`;
      counts.set(baseLabel, existing + 1);
      result.set(block.id, displayName);
    }
  }

  return result;
}

/**
 * Strip characters that would force the expression engine into the
 * bracket-access form.  Keeps letters, digits, and underscores so
 * `$node.OpenAI.json.x` works without quotes when possible.
 */
function sanitiseLabel(label: string): string {
  // Collapse runs of non-alphanumeric chars and trim.
  const cleaned = label.replace(/[^A-Za-z0-9]+/g, '');
  if (!cleaned) return 'Node';
  // Display names can't start with a digit — prefix with `_` if so.
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
}

/**
 * Lookup helper used by the picker when emitting a token.
 * Falls back to the block id if the name map somehow doesn't contain it.
 */
export function nameForBlock(
  blockId: string,
  nameMap: Map<string, string>,
): string {
  return nameMap.get(blockId) ?? blockId;
}

/**
 * Format a node-output reference as a SabFlow expression token.
 *
 *   tokenForField("OpenAI", "choices.0.message.content")
 *     → '{{ $node["OpenAI"].json.choices.0.message.content }}'
 *
 * Always uses bracket access for safety — the engine accepts both forms but
 * bracket access handles every legal identifier including those with digits
 * mid-path (array indices).
 */
export function tokenForField(displayName: string, fieldKey: string): string {
  return `{{ $node["${displayName}"].json.${fieldKey} }}`;
}

/** Best-effort: returns the friendly node name from inside a token. */
export function parseTokenNodeName(token: string): string | null {
  const m = token.match(/\$node\[["']([^"']+)["']\]/);
  return m ? m[1] : null;
}

/** Best-effort: extracts the dotted field path from a `$node[...]` token. */
export function parseTokenField(token: string): string | null {
  const m = token.match(/\$node\[["'][^"']+["']\]\.json\.([A-Za-z0-9_.\[\]]+)/);
  return m ? m[1] : null;
}

/** True for any `{{ $node["..."].json.x }}` token. */
export function isNodeOutputToken(s: string): boolean {
  return /\{\{\s*\$node\[["'][^"']+["']\]/.test(s);
}

/** True for any `{{ $vars.x }}` or bare `{{ name }}` variable token. */
export function isVarToken(s: string): boolean {
  return /\{\{\s*(\$vars\.|[A-Za-z_])/.test(s) && !isNodeOutputToken(s);
}
