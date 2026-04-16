/**
 * Forge registry — module-level Map keyed by block id.
 *
 * Blocks are registered by simply importing them from `./index.ts`, which
 * pulls every `./blocks/*` file and each file calls `registerForgeBlock` at
 * module-eval time.
 */

import type { ForgeAction, ForgeBlock } from './types';

const registry: Map<string, ForgeBlock> = new Map();

/**
 * Register a forge block.  Subsequent registrations of the same id overwrite
 * the previous entry — this keeps HMR behaviour predictable in dev.
 */
export function registerForgeBlock(block: ForgeBlock): void {
  registry.set(block.id, block);
}

/** Fetch a single registered block by id. */
export function getForgeBlock(id: string): ForgeBlock | undefined {
  return registry.get(id);
}

/** Return every registered forge block (insertion order). */
export function getForgeBlocks(): ForgeBlock[] {
  return Array.from(registry.values());
}

/**
 * Locate the action for a multi-action block.  Returns `undefined` when the
 * block is single-action or the action id does not exist.
 */
export function getForgeAction(
  blockId: string,
  actionId: string,
): ForgeAction | undefined {
  const block = registry.get(blockId);
  return block?.actions?.find((a) => a.id === actionId);
}

/** Clear the registry — intended for tests only. */
export function __resetForgeRegistry(): void {
  registry.clear();
}
