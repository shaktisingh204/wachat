/**
 * SabCRM — core type system.
 *
 * SabCRM is a metadata-driven CRM ported from the architecture of
 * twentyhq/twenty. The central idea: objects and their fields are *data*
 * (see {@link ObjectMetadata} / {@link FieldMetadata}), not hardcoded
 * screens. A single generic record runtime renders every object as a
 * table, a kanban board, a detail panel and a ⌘K command-menu entry.
 *
 * Standard objects (Companies, People, Opportunities, Notes, Tasks) are
 * seeded in `./schema`. Custom objects/fields can be layered on top later
 * by persisting additional metadata documents — the runtime never needs
 * to change.
 */

/** Every supported field data-type. Mirrors Twenty's FieldMetadataType. */
export type FieldType =
  | 'TEXT'
  | 'NUMBER'
  /** Twenty's high-precision numeric (string-backed). Renders like NUMBER. */
  | 'NUMERIC'
  | 'CURRENCY'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATE_TIME'
  | 'EMAIL'
  | 'PHONE'
  | 'LINK'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'RATING'
  | 'RELATION'
  | 'FILE'
  // Composite & multi-value field types (ported from Twenty).
  | 'FULL_NAME'
  | 'ADDRESS'
  | 'EMAILS'
  | 'PHONES'
  | 'LINKS'
  | 'ARRAY'
  | 'RAW_JSON'
  /** Audit actor composite — `{ source, workspaceMemberId, name }`. */
  | 'ACTOR'
  /** Twenty's rich text v2 composite — `{ blocknote, markdown }`. */
  | 'RICH_TEXT_V2'
  /** LLM-computed field. Config in settings.ai; value is a plain scalar in data. */
  | 'AI';

/** A single option for SELECT / MULTI_SELECT fields. */
export interface FieldOption {
  value: string;
  label: string;
  /** Token name from `--ui20-*` palette or a hex color. */
  color?: string;
}

/** Relation target descriptor for RELATION fields. */
export interface FieldRelation {
  /** Slug of the object this field points at, e.g. `companies`. */
  targetObject: string;
  /** Cardinality from the perspective of THIS record. */
  kind: 'MANY_TO_ONE' | 'ONE_TO_MANY';
  /** Field on the target object used as the human label. */
  labelField?: string;
}

/** Definition of one field on an object. */
export interface FieldMetadata {
  /** Stable key used as the property name inside a record's `data`. */
  key: string;
  label: string;
  type: FieldType;
  /** Lucide / UI20_ICONS icon name shown in column headers + detail rows. */
  icon?: string;
  description?: string;
  required?: boolean;
  /** Shown as a column in the default table view. */
  inTable?: boolean;
  /** Used as the record's display title (one per object). */
  isLabel?: boolean;
  /** SELECT/MULTI_SELECT options. */
  options?: FieldOption[];
  /** RELATION target. */
  relation?: FieldRelation;
  /** Default value applied on create. */
  defaultValue?: unknown;
  /** System fields cannot be edited or removed by users. */
  system?: boolean;
  /** Type-discriminated per-field settings blob (Twenty parity; AI fields use settings.ai). */
  settings?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// AI computed fields (FieldType 'AI')
// ---------------------------------------------------------------------------

/** What an AI field produces. Drives coercion, display and filter operators. */
export type AiOutputType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'RATING';

/** Every recognised {@link AiOutputType} (validates persisted blobs). */
export const AI_OUTPUT_TYPES: ReadonlySet<string> = new Set<AiOutputType>([
  'TEXT',
  'NUMBER',
  'BOOLEAN',
  'SELECT',
  'RATING',
]);

/** `settings.ai` blob on a FieldMetadata of type 'AI'. */
export interface AiFieldConfig {
  /** Prompt template; `{{fieldKey}}` tokens interpolate sibling data values. */
  prompt: string;
  /** Output coercion target. SELECT requires `field.options`. */
  outputType: AiOutputType;
  /** 'auto' = scheduler recomputes when inputs change; 'manual' = only on demand. */
  refresh: 'auto' | 'manual';
}

/**
 * Parse a field's `settings.ai` defensively; null when absent/malformed.
 * Returns null unless `field.type === 'AI'` and `settings.ai.prompt` is a
 * non-empty string. `outputType` falls back to `'TEXT'` when not one of the
 * five literals; `refresh` falls back to `'auto'`.
 */
export function aiFieldConfig(field: FieldMetadata): AiFieldConfig | null {
  if (field.type !== 'AI') return null;
  const settings = field.settings;
  if (!settings || typeof settings !== 'object') return null;
  const ai = (settings as { ai?: unknown }).ai;
  if (!ai || typeof ai !== 'object' || Array.isArray(ai)) return null;
  const blob = ai as { prompt?: unknown; outputType?: unknown; refresh?: unknown };
  if (typeof blob.prompt !== 'string' || blob.prompt.trim().length === 0) {
    return null;
  }
  const outputType: AiOutputType = AI_OUTPUT_TYPES.has(String(blob.outputType))
    ? (blob.outputType as AiOutputType)
    : 'TEXT';
  const refresh: 'auto' | 'manual' = blob.refresh === 'manual' ? 'manual' : 'auto';
  return { prompt: blob.prompt, outputType, refresh };
}

/** A board (kanban) configuration derived from a SELECT field. */
export interface BoardConfig {
  /** SELECT field whose options become the columns. */
  groupByField: string;
}

/** Definition of one object (a.k.a. a CRM "table"). */
export interface ObjectMetadata {
  /** URL + collection slug, plural kebab, e.g. `opportunities`. */
  slug: string;
  /** Singular human label, e.g. `Opportunity`. */
  labelSingular: string;
  /** Plural human label, e.g. `Opportunities`. */
  labelPlural: string;
  /** UI20_ICONS / lucide icon name for nav + headers. */
  icon: string;
  description?: string;
  fields: FieldMetadata[];
  /** Views this object supports. `table` is always implied. */
  views: Array<'table' | 'board'>;
  /** Kanban configuration when `board` view is enabled. */
  board?: BoardConfig;
  /** Whether this is a built-in standard object. */
  standard?: boolean;
}

/** A persisted record. `data` is a free-form map keyed by field keys. */
export interface CrmRecord {
  _id: string;
  /** Object slug this record belongs to. */
  object: string;
  /** Owning workspace/user (scoping key — mirrors existing CRM). */
  userId: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Resolved relation expansions for a record, keyed by the relation field key.
 * A MANY_TO_ONE field yields a single labelled record (or null); a
 * ONE_TO_MANY field yields an array. Populated by `relations.server.ts`.
 */
export type ExpandedRelations = Record<
  string,
  CrmRecordWithLabel | CrmRecordWithLabel[] | null
>;

/** A record decorated with its resolved display label (+ optional relations). */
export interface CrmRecordWithLabel extends CrmRecord {
  label: string;
  /** Resolved related records, present only when relations were expanded. */
  expanded?: ExpandedRelations;
}

/** Generic, serialisable result wrapper for server actions. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Paginated list payload. */
export interface RecordPage {
  records: CrmRecordWithLabel[];
  total: number;
  page: number;
  pageSize: number;
}

/** Query options for listing records. */
export interface RecordQuery {
  object: string;
  page?: number;
  pageSize?: number;
  search?: string;
  /** Field key → exact value filters. */
  filters?: Record<string, unknown>;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}
