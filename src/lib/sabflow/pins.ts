/**
 * n8n-style multi-output pin defaults per block type.
 *
 * A SabFlow block advertises one output per pin.  Blocks that model a single
 * linear "next" step (bubble / input blocks) return `null`, keeping the
 * legacy single-edge behaviour.  Integration and branching blocks default to
 * a pair of success/error or A/B pins.
 *
 * The Block document may override these defaults via `block.outputPins`.
 * Call `getEffectivePins(block)` when the caller wants stored pins to win.
 */

import type { Block, BlockType, OutputPin } from '@/lib/sabflow/types';

/** Common pin colour palette. Keep in sync with the BlockSettingsPanel picker. */
export const PIN_COLORS = {
  success: '#10b981',
  error: '#ef4444',
  pathA: '#3b82f6',
  pathB: '#f59e0b',
  loop: '#8b5cf6',
  done: '#10b981',
  pass: '#10b981',
  fail: '#ef4444',
} as const;

/**
 * Block types that advertise success + error outputs.
 * These are the external calls most likely to fail at runtime.
 */
const SUCCESS_ERROR_BLOCKS: ReadonlySet<BlockType> = new Set<BlockType>([
  'webhook',
  'send_email',
  'google_sheets',
  'open_ai',
  'anthropic',
  'mistral',
  'elevenlabs',
  'chatwoot',
  'nocodb',
]);

/**
 * Returns the default pin list for a block type, or `null` to indicate the
 * block should keep its original single-endpoint behaviour.
 *
 * Note: the block type union does not currently include `stripe`; credit card
 * collection lives under `payment_input` and is handled by the standard input
 * pipeline.  We still match the literal string `stripe` so future forge
 * integrations that register that identifier get the pins for free.
 */
export function getDefaultPins(blockType: BlockType): OutputPin[] | null {
  if (SUCCESS_ERROR_BLOCKS.has(blockType) || (blockType as string) === 'stripe') {
    return [
      { id: 'success', label: 'On success', color: PIN_COLORS.success },
      { id: 'error', label: 'On error', color: PIN_COLORS.error },
    ];
  }

  if (blockType === 'ab_test') {
    return [
      { id: 'a', label: 'Path A', color: PIN_COLORS.pathA },
      { id: 'b', label: 'Path B', color: PIN_COLORS.pathB },
    ];
  }

  if (blockType === 'script') {
    return [
      { id: 'success', label: 'On success', color: PIN_COLORS.success },
      { id: 'error', label: 'On error', color: PIN_COLORS.error },
    ];
  }

  if (blockType === 'loop') {
    return [
      { id: 'loop', label: 'Loop', color: PIN_COLORS.loop },
      { id: 'done', label: 'Done', color: PIN_COLORS.done },
      { id: 'error', label: 'Error', color: PIN_COLORS.error },
    ];
  }

  if (blockType === 'filter') {
    return [
      { id: 'pass', label: 'Pass', color: PIN_COLORS.pass },
      { id: 'fail', label: 'Fail', color: PIN_COLORS.fail },
    ];
  }

  if (blockType === 'switch') {
    return [
      { id: 'case_1', label: 'Case 1', color: PIN_COLORS.pathA },
      { id: 'case_2', label: 'Case 2', color: PIN_COLORS.pathB },
      { id: 'default', label: 'Default', color: '#9ca3af' },
    ];
  }

  return null;
}

/**
 * Resolves the pin list actually attached to a block:
 *   - explicit `block.outputPins` wins when present and non-empty
 *   - otherwise falls back to `getDefaultPins(block.type)`
 *   - returns `null` for blocks with a single output endpoint
 */
export function getEffectivePins(block: Block): OutputPin[] | null {
  const custom = (block as { outputPins?: OutputPin[] }).outputPins;
  if (custom && custom.length > 0) return custom;
  return getDefaultPins(block.type);
}

/** Returns true when this block renders as a multi-pin source node. */
export function hasMultiplePins(block: Block): boolean {
  const pins = getEffectivePins(block);
  return !!pins && pins.length > 1;
}
