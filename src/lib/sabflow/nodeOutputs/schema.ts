/**
 * Output-schema types for the upstream data picker.
 *
 * Each block type can declare what fields it emits when it runs.  The picker
 * uses these to show users a typed dropdown of "previous node outputs"
 * instead of forcing them to type `{{ $node["X"].json.foo }}` from memory.
 *
 * Schemas are intentionally flat — `key` is a dotted path that the engine's
 * property accessor walks (e.g. `choices.0.message.content`).
 */

export type NodeOutputFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'date'
  | 'binary';

export type NodeOutputField = {
  /** Dotted path into the node's JSON output, e.g. "choices.0.message.content". */
  key: string;
  /** Human label shown in the picker, e.g. "Message content". */
  label: string;
  /** Approximate type — used for type-aware filtering and chip colour. */
  type: NodeOutputFieldType;
  /** Optional one-line description shown on hover. */
  description?: string;
  /** Sample value rendered greyed-out in the picker row. */
  example?: unknown;
};

/**
 * A node ready to display in the picker — already resolved to a stable
 * display name, with its output schema attached.
 */
export type UpstreamNode = {
  /** Block id (cuid). */
  blockId: string;
  /** Block type slug, e.g. "open_ai". */
  blockType: string;
  /** Stable display name used as the `$node["..."]` key. */
  displayName: string;
  /** Label of the block type, e.g. "OpenAI". */
  typeLabel: string;
  /** Output fields available on this node. */
  fields: NodeOutputField[];
  /**
   * Last observed output (from a recent test/execution).  When present, the
   * picker renders the actual value next to each field as a preview.
   */
  lastRun?: unknown;
  /**
   * How far back this node is from the current block in the graph (0 = current,
   * 1 = direct parent, etc.).  Used to sort picker results.
   */
  distance: number;
};
