/**
 * Barrel for the node-output schema system.
 *
 * The data picker UI consumes this module to build its "previous node outputs"
 * dropdown.  Runtime callers (the engine) can also import declarations to seed
 * `$node` resolution once that's wired through.
 */

export type {
  NodeOutputField,
  NodeOutputFieldType,
  UpstreamNode,
} from './schema';

export {
  BLOCK_OUTPUT_SCHEMAS,
  FALLBACK_FIELDS,
  getDeclaredFields,
} from './declarations';

export {
  buildBlockNameMap,
  nameForBlock,
  tokenForField,
  parseTokenNodeName,
  parseTokenField,
  isNodeOutputToken,
  isVarToken,
} from './nodeNames';

export { collectUpstream } from './collectUpstream';
export type { UpstreamRef } from './collectUpstream';

export { mergeWithLastRun } from './mergeWithLastRun';
