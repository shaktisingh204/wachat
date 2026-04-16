/**
 * Forge — declarative block schema for SabFlow integrations.
 *
 * Inspired by Typebot's Forge and Zapier's Platform CLI, this module lets
 * integration authors register a new block by exporting a schema (fields +
 * an async `run` function) instead of writing bespoke UI + runtime code for
 * every connector.
 */

/* ── Field primitives ────────────────────────────────────────────────────── */

export type ForgeFieldType =
  | 'text'
  | 'textarea'
  | 'password'
  | 'number'
  | 'select'
  | 'toggle'
  | 'variable'
  | 'json'
  | 'code'
  | 'key-value-list'
  | 'credential';

/** A key/value pair as stored by `key-value-list` fields. */
export type ForgeKeyValuePair = {
  id: string;
  key: string;
  value: string;
};

/** Primitive shapes a ForgeField can serialise into. */
export type ForgeFieldValue =
  | string
  | number
  | boolean
  | ForgeKeyValuePair[]
  | Record<string, unknown>
  | null
  | undefined;

export type ForgeSelectOption = {
  label: string;
  value: string;
};

export type ForgeShowIf = {
  field: string;
  equals: ForgeFieldValue;
};

export type ForgeField = {
  /** Unique field id — becomes the key inside the options object. */
  id: string;
  /** Human-readable label shown above the input. */
  label: string;
  /** Renderer hint. */
  type: ForgeFieldType;
  /** Placeholder text (text / textarea / password / number / json / code). */
  placeholder?: string;
  /** Helper text rendered beneath the control. */
  helperText?: string;
  /** Whether the field must be filled in before executing the action. */
  required?: boolean;
  /** Default value applied when the block is created. */
  defaultValue?: ForgeFieldValue;
  /** Options for `select` fields. */
  options?: ForgeSelectOption[];
  /** Credential type id for `credential` fields. */
  credentialType?: string;
  /** Conditionally render the field based on another field's value. */
  showIf?: ForgeShowIf;
};

/* ── Action runtime ──────────────────────────────────────────────────────── */

export type ForgeActionContext = {
  /** Merged block options + selected action options (resolved values). */
  options: Record<string, unknown>;
  /** Current flow session variables. */
  variables: Record<string, unknown>;
  /** Resolved credential (if the block declared `auth`). */
  credential?: Record<string, string>;
};

export type ForgeActionResult = {
  /** Values to write back into flow variables (keyed by variable id/name). */
  outputs?: Record<string, unknown>;
  /** Human-readable log lines appended to the run transcript. */
  logs?: string[];
};

export type ForgeAction = {
  /** Unique action id within the block. */
  id: string;
  /** Action label shown in the action selector. */
  label: string;
  /** Short description rendered below the label. */
  description?: string;
  /** Fields specific to this action. */
  fields: ForgeField[];
  /** Server-side executor. Must be safe to call from a Node.js runtime. */
  run: (ctx: ForgeActionContext) => Promise<ForgeActionResult>;
};

/* ── Auth ────────────────────────────────────────────────────────────────── */

export type ForgeAuthType = 'apiKey' | 'oauth' | 'none';

export type ForgeAuth = {
  type: ForgeAuthType;
  /** Fields the user fills in to create a credential. */
  fields?: ForgeField[];
};

/* ── Block schema ────────────────────────────────────────────────────────── */

export type ForgeBlockCategory = 'Integration' | 'Logic' | 'Input' | 'Bubble';

export type ForgeBlock = {
  /** Unique block id — used as the forge BlockType discriminator. */
  id: string;
  /** Display name in palettes / nodes / settings header. */
  name: string;
  /** One-line summary shown in the block palette. */
  description: string;
  /** Optional remote icon URL. */
  iconUrl?: string;
  /** react-icons/lu icon name (preferred over iconUrl when both are present). */
  iconName?: string;
  /** Category bucket used by the block palette. */
  category: ForgeBlockCategory;
  /** Single-action blocks declare fields directly here. */
  fields?: ForgeField[];
  /** Multi-action blocks declare an action list and render an action selector. */
  actions?: ForgeAction[];
  /** Credential schema — shown above the action selector when present. */
  auth?: ForgeAuth;
};

/* ── Type-guard helpers ──────────────────────────────────────────────────── */

/** Returns true when the block uses the multi-action layout. */
export const isMultiActionBlock = (
  block: ForgeBlock,
): block is ForgeBlock & { actions: ForgeAction[] } =>
  Array.isArray(block.actions) && block.actions.length > 0;

/** Returns true when the field is currently visible given the options snapshot. */
export const isFieldVisible = (
  field: ForgeField,
  values: Record<string, unknown>,
): boolean => {
  if (!field.showIf) return true;
  return values[field.showIf.field] === field.showIf.equals;
};
