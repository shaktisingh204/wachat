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
  | 'credential'
  | 'resourceLocator';

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

/**
 * One input mode of a `resourceLocator` field. Mirrors n8n's
 * `INodePropertyMode`. A field declares 2–3 of these (typically list/id/url).
 *
 * `name` is the stable key persisted in `ResourceLocatorValue.mode`.
 *
 * `type` decides the renderer:
 *   - `'list'`    → searchable dropdown driven by `field.loadOptions`
 *   - `'string'`  → free-text input
 *
 * `extractValue` (string mode only): apply this regex to the typed value
 * and use match group 1 as the resolved id. Used for URL pastes — e.g.
 * `'discord.com/channels/[0-9]+/([0-9]+)'` pulls the channel id out of
 * a full Discord URL.
 *
 * `validation` (string mode only): client-side regex check; if it fails
 * the renderer shows `errorMessage`. Does not block submit on its own —
 * callers can opt in to harder validation later.
 *
 * `searchListMethod` (list mode only): name of the search method. Today
 * the field's `loadOptions` resolver is invoked directly regardless of
 * mode; the name is recorded for parity with n8n's port pattern and for
 * use by Phase 3's search-as-you-type plumbing.
 */
export type ForgeFieldMode = {
  name: 'list' | 'id' | 'url' | 'string';
  displayName: string;
  type: 'list' | 'string';
  placeholder?: string;
  extractValue?: { type: 'regex'; regex: string };
  validation?: { regex: string; errorMessage: string };
  searchListMethod?: string;
};

/**
 * The persisted shape of a `resourceLocator` field's value. `mode` records
 * which input the user used so the renderer can rehydrate the right tab;
 * `value` is the raw string (a list selection id, a typed id, or a URL).
 * `extractValue` (helper in `./extractValue.ts`) normalises this into a
 * plain string id before the action runs.
 */
export type ResourceLocatorValue = {
  mode: 'list' | 'id' | 'url' | 'string';
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
  /**
   * `helpers.requestWithAuthentication(auth, req)` — Phase 4 platform-owned
   * HTTP fetcher. Closes over the resolved credential so resolvers never
   * see raw tokens. Optional for back-compat: legacy resolvers that hand-
   * roll fetch via `ctx.credential` keep working unchanged.
   */
  helpers?: import('./helpers').ForgeHelpers;
  /**
   * Type-ahead query forwarded from the editor (Phase 3). Resolvers SHOULD
   * apply server-side filtering when their provider supports it.
   */
  filter?: string;
  /**
   * Opaque cursor returned by a previous page (Phase 3). Forwarded back to
   * the provider's "next page" call. Resolvers that don't paginate ignore.
   */
  paginationToken?: string | null;
};

/**
 * Result shape of a `loadOptions` resolver (Phase 3 union):
 *   • plain array — for static / fully-loaded lists (one page, no cursor)
 *   • envelope `{ results, paginationToken }` — for paginated providers
 * `paginationToken: null` means the cursor is exhausted.
 */
export type ForgeLoadOptionsResult =
  | ForgeSelectOption[]
  | {
      results: ForgeSelectOption[];
      paginationToken?: string | null;
    };

/** Async resolver that returns dropdown options at runtime. */
export type ForgeLoadOptions = (
  ctx: ForgeLoadOptionsContext,
) => Promise<ForgeLoadOptionsResult>;

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
  /**
   * For `type: 'resourceLocator'` fields: the available input modes. The
   * first entry is the default mode for newly-created fields. Renderer
   * presents one tab per mode; the persisted value records which mode the
   * user picked (see `ResourceLocatorValue`).
   */
  modes?: ForgeFieldMode[];
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
  /**
   * Current item index when the executor is iterating per-item over an
   * upstream block's `items` array. `0` (or undefined) when the block ran
   * once on a single upstream output. Equivalent to n8n's `itemIndex`.
   */
  itemIndex?: number;
  /**
   * Current item's JSON payload when iterating. Mirrors n8n's `$json` —
   * the proxy reads this so `{{ $json.foo }}` resolves to the right item.
   * Undefined when no iteration is in progress.
   */
  currentItem?: Record<string, unknown>;
  /**
   * `helpers.requestWithAuthentication(auth, req)` — Phase 4 platform-owned
   * HTTP fetcher. Closes over the resolved credential so actions never see
   * raw tokens. Optional for back-compat with legacy `fetch(..., { headers:
   * { Authorization: 'Bearer ' + ctx.credential!.accessToken }})` patterns.
   */
  helpers?: import('./helpers').ForgeHelpers;
};

export type ForgeActionResult = {
  /** Values to write back into flow variables (keyed by variable id/name). */
  outputs?: Record<string, unknown>;
  /**
   * Per-item output payloads — when present, the executor exposes these to
   * the next block as an iterable array, and each downstream invocation
   * sees one item as `$json`. Use this for `getAll` / `list` operations
   * that naturally return multiple rows. Existing actions that return only
   * `outputs` keep their single-result semantics.
   */
  items?: Array<Record<string, unknown>>;
  /**
   * For multi-output blocks (IF / Switch / Filter / etc.): which declared
   * output port the run selected. Must match a `name` from the block's or
   * action's `outputs` array. The executor uses this to pick the outgoing
   * edge whose `sourceHandle === 'outputs/main/<index>'`. Ignored when the
   * block declares only a single output.
   */
  selectedOutput?: string;
  /**
   * Per-item branching (Phase 12): split items across multiple output
   * ports in a single run. Keys are output port `name`s (matching the
   * block's `outputs` declaration); values are the items routed to that
   * port. The executor reads each port's items and distributes them to
   * the matching downstream branch (`sourceHandle: 'outputs/main/<idx>'`).
   *
   * When set, `itemsByOutput` takes precedence over `selectedOutput` /
   * `items` for routing — actions that need true per-item splits return
   * this instead. The first non-empty branch's items also become the
   * legacy `forgeItems` so single-output downstream readers keep working.
   */
  itemsByOutput?: Record<string, Array<Record<string, unknown>>>;
  /** Human-readable log lines appended to the run transcript. */
  logs?: string[];
};

/**
 * One output port on a forge block. Mirrors n8n's per-node output array.
 * Blocks default to a single `{ name: 'main' }` output when omitted, which
 * preserves every existing block's behaviour.
 */
export type ForgeOutput = {
  /** Stable key — used to look up the port in `ForgeActionResult.selectedOutput`. */
  name: string;
  /** Human-readable label shown on the edge handle in the editor. */
  displayName?: string;
};

/**
 * Back-reference from a downstream item to the upstream item that produced
 * it. Stored in a parallel `pairedItems` array on each block's output so
 * the expression engine can walk ancestry via `$getPairedItem('NodeName')`.
 * Mirrors n8n's `INodeExecutionData.pairedItem`.
 */
export type PairedItemRef = {
  /** Index of the producing item in the immediately-upstream node's items. */
  item: number;
  /** Input branch on the upstream node — always 0 today (single-input). */
  input?: number;
};

export type ForgeAction = {
  /** Unique action id within the block. */
  id: string;
  /**
   * Opt OUT of per-item iteration. When upstream emits an `items` array,
   * the default is to run this action once per item (matching n8n).
   * Set to `false` for actions whose semantics are "process the whole
   * batch at once" — e.g. HTTP body builders that take an array, merge
   * nodes that aggregate, transactional sends. Defaults to `true`.
   */
  iteratesItems?: boolean;
  /**
   * Override the block's `outputs` declaration for this specific action.
   * Useful when most actions in a block are single-output but one (e.g.
   * `evaluate-condition`) needs branching. Defaults to the block's
   * `outputs`, which defaults to a single `{ name: 'main' }`.
   */
  outputs?: ForgeOutput[];
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
  /**
   * Output ports the block exposes. Defaults to `[{ name: 'main' }]` when
   * omitted, which gives the existing single-output behaviour. Multi-output
   * blocks (IF, Switch, Filter) declare e.g.
   *   `outputs: [{ name: 'true' }, { name: 'false' }]`
   * Edges leaving such a block carry `sourceHandle: 'outputs/main/<index>'`
   * matching the position in this array. An action picks which port the
   * run took via `ForgeActionResult.selectedOutput`.
   */
  outputs?: ForgeOutput[];
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
