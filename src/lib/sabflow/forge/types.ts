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

/**
 * Context passed to a field's `loadOptions` resolver.
 *
 * Resolvers are invoked server-side via `/api/sabflow/load-options` so they
 * have access to the decrypted credential record + the current options
 * snapshot for cross-field dependencies (e.g. board → list).
 */
export type ForgeLoadOptionsContext = {
  /** Resolved credential record (decrypted). Undefined when the block's auth.credentialType is not set OR no credential is selected yet. */
  credential?: Record<string, string>;
  /** Current snapshot of other field values — useful when one dropdown depends on another. */
  options: Record<string, unknown>;
  /**
   * Read a field value off the current node. Mirrors n8n's
   * `ILoadOptionsFunctions.getNodeParameter`. Returns `fallback` when the
   * field is absent. Resolvers should prefer this over poking `ctx.options`
   * directly so resourceLocator values get auto-extracted in Phase 2.
   */
  getNodeParameter?: (name: string, fallback?: unknown) => unknown;
  /**
   * Same as `getNodeParameter` but reads the *currently-editing* value from
   * the editor (may be unsaved). For load-options requests these are the
   * same source; the distinction exists to match n8n's signature.
   */
  getCurrentNodeParameter?: (name: string, fallback?: unknown) => unknown;
  /** Minimal node identity exposed for diagnostics + provider call attribution. */
  getNode?: () => { id: string; name: string };
};

/** Async resolver that returns dropdown options at runtime. */
export type ForgeLoadOptions = (
  ctx: ForgeLoadOptionsContext,
) => Promise<ForgeSelectOption[]>;

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
  /**
   * Optional dynamic-options resolver for `select` fields. Runs server-side
   * (via `/api/sabflow/load-options`) so it can read decrypted credentials
   * and other field values. Merged with the static `options` list on the
   * client.
   */
  loadOptions?: ForgeLoadOptions;
  /**
   * Field names whose value affects this field's options. When any listed
   * field changes in the editor, the renderer re-fetches this field's
   * options. Mirrors n8n's `typeOptions.loadOptionsDependsOn`.
   */
  loadOptionsDependsOn?: string[];
  /**
   * Conditionally show/hide the field based on other fields' values.
   * Mirrors n8n's `displayOptions`. Semantics:
   *   • `show`: ALL listed fields must equal one of the allowed values
   *   • `hide`: if ANY listed field equals one of the allowed values, hide
   * `hide` takes precedence over `show`. When `displayOptions` is present,
   * the legacy `showIf` rule is ignored.
   */
  displayOptions?: {
    show?: Record<string, unknown[]>;
    hide?: Record<string, unknown[]>;
  };
};

/* ── Action runtime ──────────────────────────────────────────────────────── */

export type ForgeActionContext = {
  /** Merged block options + selected action options (resolved values). */
  options: Record<string, unknown>;
  /** Current flow session variables. */
  variables: Record<string, unknown>;
  /** Resolved credential (if the block declared `auth`). */
  credential?: Record<string, string>;
  /**
   * Workspace owner (userId) that owns the calling flow.  Optional for
   * back-compat; callers that need cross-resource access (sub-workflow
   * execution, env-var loads) require it.
   */
  userId?: string;
  /**
   * Stack of flow ids currently being executed, oldest first.  Sub-workflow
   * execution uses this to detect cycles and reject self-references.  Empty
   * or undefined on a top-level run.
   */
  callerStack?: string[];
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
  /**
   * SabFlow credential type id (matches `CredentialType` in
   * `src/lib/sabflow/credentials/types.ts`). When set, the block renders a
   * credential picker bound to that type and the engine resolves the chosen
   * credential into `ctx.credential` at run time.
   *
   * When omitted, the block falls back to the legacy `fields` mode (auth
   * fields inlined into block options) — kept for the original forge blocks.
   */
  credentialType?: string;
  /**
   * Legacy inline auth fields. Prefer `credentialType` for new ports — it
   * routes the credential through the Connections tab + encrypted storage.
   */
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
  if (field.displayOptions) {
    const { show, hide } = field.displayOptions;
    if (hide) {
      for (const [k, allowed] of Object.entries(hide)) {
        if (allowed.some((v) => v === values[k])) return false;
      }
    }
    if (show) {
      for (const [k, allowed] of Object.entries(show)) {
        if (!allowed.some((v) => v === values[k])) return false;
      }
    }
    return true;
  }
  if (!field.showIf) return true;
  return values[field.showIf.field] === field.showIf.equals;
};
