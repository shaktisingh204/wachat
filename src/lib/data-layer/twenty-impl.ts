import 'server-only';

/**
 * Lane 1 — Twenty data-layer implementation (PLAN.md §5, Phase 4/4C).
 *
 * Concrete {@link CrmDataLayer} backed by the running `twenty-server` via the C5
 * GraphQL client ({@link twentyFetch}). It speaks the same metadata + record
 * GraphQL the Twenty frontend uses (see
 * `services/sabcrm/packages/twenty-front/src/modules/object-{metadata,record}`),
 * then maps Twenty's shapes onto SabCRM's {@link ObjectMetadata} /
 * {@link FieldMetadata} / {@link CrmRecord}.
 *
 * Tenancy: every method needs a workspace-scoped bearer token. We accept it via
 * a {@link TwentyImplContext} (the C6 bridge result / its `token`). The router
 * resolves that token before constructing the impl, so this file never touches
 * the identity bridge directly — it just carries the token into `twentyFetch`.
 *
 * Gating: this impl is only ever returned when `resolveCrmDataLayerKind()`
 * (CRM_DATA_LAYER === 'twenty') selects it. The default ('rust') keeps flowing
 * through the existing stub, so default behaviour is unchanged.
 *
 * Every method is wrapped so a transport / GraphQL failure becomes an
 * `ActionResult { ok: false }` rather than a throw.
 */

import type {
  ActionResult,
  FieldMetadata,
  FieldOption,
  FieldRelation,
  FieldType,
  ObjectMetadata,
} from '@/lib/sabcrm/types';
import { twentyFetch, TwentyApiError, type TwentyRequestContext } from './twenty-client';
import type {
  CrmDataLayer,
  CrmRecord,
  ListRecordsParams,
  RecordsPage,
} from './router';

/**
 * Token + optional base URL the impl needs for every call (from the C6 bridge).
 *
 * `token` may be a string or a (cached) async resolver — the router can pass a
 * thunk that lazily calls `bridgeUserToTwenty(...)` so the synchronous
 * `getCrmDataLayer` factory doesn't have to await the bridge up front.
 */
export interface TwentyImplContext {
  /** Bearer access token (string) or an async resolver that mints/returns one. */
  token: string | (() => Promise<string>);
  /** Override the twenty-server base URL (tests / per-env). */
  baseUrl?: string;
}

// ---------------------------------------------------------------------------
// Twenty wire shapes (only the fields we select). Mirrors the twenty-front
// object-metadata fragment + the generated record query connections.
// ---------------------------------------------------------------------------

type TwentyRelationType = 'ONE_TO_MANY' | 'MANY_TO_ONE';

interface TwentyFieldRelationWire {
  type: TwentyRelationType;
  targetObjectMetadata: {
    id: string;
    nameSingular: string;
    namePlural: string;
  } | null;
}

interface TwentyFieldOptionWire {
  value: string;
  label: string;
  color?: string;
  position?: number;
}

interface TwentyFieldWire {
  id: string;
  type: string;
  name: string;
  label: string;
  description?: string | null;
  icon?: string | null;
  isCustom?: boolean | null;
  isActive?: boolean | null;
  isSystem?: boolean | null;
  isNullable?: boolean | null;
  defaultValue?: unknown;
  options?: TwentyFieldOptionWire[] | null;
  settings?: Record<string, unknown> | null;
  relation?: TwentyFieldRelationWire | null;
}

interface TwentyObjectWire {
  id: string;
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
  description?: string | null;
  icon?: string | null;
  isActive?: boolean | null;
  isSystem?: boolean | null;
  isCustom?: boolean | null;
  labelIdentifierFieldMetadataId?: string | null;
  fieldsList: TwentyFieldWire[];
}

interface ObjectsQueryResult {
  objects: { edges: Array<{ node: TwentyObjectWire }> };
}

interface RecordConnectionResult {
  [objectNamePlural: string]: {
    edges: Array<{ node: Record<string, unknown> }>;
    totalCount: number;
  };
}

// ---------------------------------------------------------------------------
// Metadata query — the authoritative shape the Twenty frontend uses.
// (twenty-front object-metadata/graphql/{queries,fragment}.ts, on `/metadata`.)
// ---------------------------------------------------------------------------

const OBJECTS_METADATA_QUERY = /* GraphQL */ `
  query SabCrmObjectMetadataItems {
    objects(paging: { first: 1000 }) {
      edges {
        node {
          id
          nameSingular
          namePlural
          labelSingular
          labelPlural
          description
          icon
          isActive
          isSystem
          isCustom
          labelIdentifierFieldMetadataId
          fieldsList {
            id
            type
            name
            label
            description
            icon
            isCustom
            isActive
            isSystem
            isNullable
            defaultValue
            options
            settings
            relation {
              type
              targetObjectMetadata {
                id
                nameSingular
                namePlural
              }
            }
          }
        }
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Field-type mapping: Twenty's FieldMetadataType -> SabCRM FieldType.
// ---------------------------------------------------------------------------

const FIELD_TYPE_MAP: Record<string, FieldType> = {
  TEXT: 'TEXT',
  NUMBER: 'NUMBER',
  NUMERIC: 'NUMERIC',
  CURRENCY: 'CURRENCY',
  BOOLEAN: 'BOOLEAN',
  DATE: 'DATE',
  DATE_TIME: 'DATE_TIME',
  SELECT: 'SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  RATING: 'RATING',
  RELATION: 'RELATION',
  FULL_NAME: 'FULL_NAME',
  ADDRESS: 'ADDRESS',
  EMAILS: 'EMAILS',
  PHONES: 'PHONES',
  LINKS: 'LINKS',
  ARRAY: 'ARRAY',
  RAW_JSON: 'RAW_JSON',
  ACTOR: 'ACTOR',
  // Twenty's names vs SabCRM's names.
  FILES: 'FILE',
  RICH_TEXT: 'RICH_TEXT_V2',
};

// Twenty field types SabCRM has no first-class column for — kept out of the
// metadata so the generic runtime never tries to render them.
const HIDDEN_FIELD_TYPES = new Set(['POSITION', 'TS_VECTOR', 'UUID', 'MORPH_RELATION']);

function mapFieldType(twentyType: string): FieldType | null {
  if (HIDDEN_FIELD_TYPES.has(twentyType)) return null;
  return FIELD_TYPE_MAP[twentyType] ?? 'TEXT';
}

function mapOptions(options?: TwentyFieldOptionWire[] | null): FieldOption[] | undefined {
  if (!Array.isArray(options) || options.length === 0) return undefined;
  return [...options]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((opt) => ({ value: opt.value, label: opt.label, color: opt.color }));
}

function mapRelation(field: TwentyFieldWire): FieldRelation | undefined {
  const rel = field.relation;
  if (!rel || !rel.targetObjectMetadata) return undefined;
  return {
    // SabCRM addresses objects by their plural slug.
    targetObject: rel.targetObjectMetadata.namePlural,
    kind: rel.type === 'ONE_TO_MANY' ? 'ONE_TO_MANY' : 'MANY_TO_ONE',
  };
}

function mapField(field: TwentyFieldWire, labelIdentifierFieldMetadataId?: string | null): FieldMetadata | null {
  const type = mapFieldType(field.type);
  if (type === null) return null;

  const mapped: FieldMetadata = {
    key: field.name,
    label: field.label,
    type,
  };
  if (field.icon) mapped.icon = field.icon;
  if (field.description) mapped.description = field.description;
  if (field.isNullable === false) mapped.required = true;
  if (field.isSystem) mapped.system = true;
  if (field.defaultValue !== undefined && field.defaultValue !== null) {
    mapped.defaultValue = field.defaultValue;
  }
  if (labelIdentifierFieldMetadataId && field.id === labelIdentifierFieldMetadataId) {
    mapped.isLabel = true;
  }

  const options = mapOptions(field.options);
  if (options) mapped.options = options;

  const relation = mapRelation(field);
  if (relation) mapped.relation = relation;

  return mapped;
}

function mapObject(node: TwentyObjectWire): ObjectMetadata {
  const fields = (node.fieldsList ?? [])
    .filter((f) => f.isActive !== false)
    .map((f) => mapField(f, node.labelIdentifierFieldMetadataId))
    .filter((f): f is FieldMetadata => f !== null);

  // SabCRM always supports `table`; `board` is enabled when there's a SELECT
  // field to group by (Twenty kanban columns derive from a SELECT field).
  const selectField = fields.find((f) => f.type === 'SELECT');
  const views: Array<'table' | 'board'> = selectField ? ['table', 'board'] : ['table'];

  const obj: ObjectMetadata = {
    slug: node.namePlural,
    labelSingular: node.labelSingular,
    labelPlural: node.labelPlural,
    icon: node.icon ?? 'IconBox',
    fields,
    views,
    standard: node.isCustom === false ? true : undefined,
  };
  if (node.description) obj.description = node.description;
  if (selectField) obj.board = { groupByField: selectField.key };
  return obj;
}

// ---------------------------------------------------------------------------
// Record helpers.
// ---------------------------------------------------------------------------

/**
 * Build the GraphQL selection set for an object's records. Selects scalar
 * fields, expands MANY_TO_ONE relations (nested record + join column) and
 * ONE_TO_MANY relations (edge connections), and pulls composite subfields
 * (ACTOR/createdBy, FULL_NAME, CURRENCY, …) so records aren't hollow.
 *
 * Mirrors twenty-front's mapFieldMetadataToGraphQLQuery, but at depth 1 only
 * (relations are expanded one level — enough to label them — without recursing
 * into the related object's own relations).
 */
function buildRecordSelection(
  object: ObjectMetadata,
  objectsBySlug: Map<string, ObjectMetadata>,
  depth = 1,
): string {
  const lines: string[] = ['id', 'createdAt', 'updatedAt'];

  for (const field of object.fields) {
    lines.push(selectForField(field, objectsBySlug, depth));
  }

  return `{\n${lines.filter(Boolean).join('\n')}\n}`;
}

function relationJoinColumn(key: string): string {
  return `${key}Id`;
}

function selectForField(
  field: FieldMetadata,
  objectsBySlug: Map<string, ObjectMetadata>,
  depth: number,
): string {
  const key = field.key;

  switch (field.type) {
    case 'RELATION': {
      const rel = field.relation;
      if (!rel) return '';
      const target = objectsBySlug.get(rel.targetObject);
      if (rel.kind === 'MANY_TO_ONE') {
        // Always grab the join column so the FK is present even at depth 0.
        const joinCol = relationJoinColumn(key);
        if (depth <= 0 || !target) return joinCol;
        return `${joinCol}\n${key} ${nestedRelationSelection(target)}`;
      }
      // ONE_TO_MANY — connection. Only expand when depth allows.
      if (depth <= 0 || !target) return '';
      return `${key} {\n  edges {\n    node ${nestedRelationSelection(target)}\n  }\n}`;
    }
    case 'CURRENCY':
      return `${key} {\n  amountMicros\n  currencyCode\n}`;
    case 'FULL_NAME':
      return `${key} {\n  firstName\n  lastName\n}`;
    case 'ADDRESS':
      return `${key} {\n  addressStreet1\n  addressStreet2\n  addressCity\n  addressState\n  addressCountry\n  addressPostcode\n  addressLat\n  addressLng\n}`;
    case 'ACTOR':
      return `${key} {\n  source\n  workspaceMemberId\n  name\n  context\n}`;
    case 'EMAILS':
      return `${key} {\n  primaryEmail\n  additionalEmails\n}`;
    case 'PHONES':
      return `${key} {\n  primaryPhoneNumber\n  primaryPhoneCountryCode\n  primaryPhoneCallingCode\n  additionalPhones\n}`;
    case 'LINKS':
      return `${key} {\n  primaryLinkUrl\n  primaryLinkLabel\n  secondaryLinks\n}`;
    case 'FILE':
      return `${key} {\n  fileId\n  label\n  extension\n  url\n}`;
    case 'RICH_TEXT_V2':
      return `${key} {\n  blocknote\n  markdown\n}`;
    default:
      // Scalar (TEXT/NUMBER/NUMERIC/BOOLEAN/DATE/DATE_TIME/SELECT/MULTI_SELECT/
      // RATING/ARRAY/RAW_JSON) — select by name.
      return key;
  }
}

/**
 * Selection for a nested related record: just enough to label it (id + the
 * related object's label field + a couple of common identity fields), without
 * recursing into the related object's own relations.
 */
function nestedRelationSelection(target: ObjectMetadata): string {
  const lines = new Set<string>(['id']);
  for (const f of target.fields) {
    if (f.isLabel) lines.add(selectForField(f, new Map(), 0));
    if (f.key === 'name' && f.type === 'TEXT') lines.add('name');
    if (f.type === 'FULL_NAME') lines.add(selectForField(f, new Map(), 0));
  }
  return `{\n${[...lines].filter(Boolean).join('\n')}\n}`;
}

/** Normalise a Twenty record node into a SabCRM CrmRecord. */
function mapRecordNode(node: Record<string, unknown>): CrmRecord {
  const { id, createdAt, updatedAt, ...rest } = node as {
    id: string;
    createdAt?: string;
    updatedAt?: string;
    [k: string]: unknown;
  };
  const data: Record<string, unknown> = { ...rest };

  // Flatten ONE_TO_MANY edge connections to plain arrays of nodes so the UI
  // doesn't have to know about Relay-style envelopes.
  for (const [k, v] of Object.entries(data)) {
    if (
      v &&
      typeof v === 'object' &&
      Array.isArray((v as { edges?: unknown }).edges)
    ) {
      data[k] = (v as { edges: Array<{ node: unknown }> }).edges.map((e) => e.node);
    }
  }

  return { id, data, createdAt, updatedAt };
}

// ---------------------------------------------------------------------------
// Helpers for filter / order / paging on the record connection.
// ---------------------------------------------------------------------------

function buildOrderBy(params: ListRecordsParams): unknown[] | undefined {
  if (!params.sortBy) return undefined;
  const dir = params.sortDir === 'desc' ? 'DescNullsLast' : 'AscNullsFirst';
  return [{ [params.sortBy]: dir }];
}

function buildFilter(object: ObjectMetadata, params: ListRecordsParams): Record<string, unknown> | undefined {
  const and: Array<Record<string, unknown>> = [];

  // Free-text search across the object's label/text fields.
  if (params.search) {
    const searchableKeys = object.fields
      .filter((f) => f.type === 'TEXT' || f.isLabel)
      .map((f) => f.key);
    const or = searchableKeys.map((k) => ({ [k]: { ilike: `%${params.search}%` } }));
    if (or.length > 0) and.push({ or });
  }

  // Exact-value filters (filter key -> value).
  if (params.filters && typeof params.filters === 'object') {
    for (const [k, value] of Object.entries(params.filters as Record<string, unknown>)) {
      if (value === undefined || value === null || value === '') continue;
      and.push({ [k]: { eq: value } });
    }
  }

  if (and.length === 0) return undefined;
  if (and.length === 1) return and[0];
  return { and };
}

// ---------------------------------------------------------------------------
// Implementation.
// ---------------------------------------------------------------------------

export class TwentyCrmDataLayer implements CrmDataLayer {
  private metadataCache: ObjectMetadata[] | null = null;
  // slug (namePlural) -> nameSingular, captured from the metadata so record
  // queries address single records by Twenty's real singular name (not a guess).
  private singularBySlug = new Map<string, string>();

  private resolvedToken: string | null = null;

  constructor(private readonly ctx: TwentyImplContext) {}

  private async requestCtx(): Promise<TwentyRequestContext> {
    if (this.resolvedToken === null) {
      this.resolvedToken =
        typeof this.ctx.token === 'function' ? await this.ctx.token() : this.ctx.token;
    }
    return { token: this.resolvedToken, baseUrl: this.ctx.baseUrl };
  }

  private fail(scope: string, err: unknown): { ok: false; error: string } {
    if (err instanceof TwentyApiError) {
      const detail = err.graphqlErrors
        ? `: ${JSON.stringify(err.graphqlErrors)}`
        : err.status
          ? ` (${err.status})`
          : '';
      return { ok: false, error: `twenty.${scope}: ${err.message}${detail}` };
    }
    return { ok: false, error: `twenty.${scope}: ${(err as Error)?.message ?? 'unknown error'}` };
  }

  /** Fetch + cache the object metadata (used both for listObjects and to build record selections). */
  private async loadObjects(): Promise<ObjectMetadata[]> {
    if (this.metadataCache) return this.metadataCache;
    const data = await twentyFetch<ObjectsQueryResult>(
      OBJECTS_METADATA_QUERY,
      undefined,
      await this.requestCtx(),
      'metadata',
    );
    const nodes = (data.objects?.edges ?? [])
      .map((e) => e.node)
      .filter((n) => n.isActive !== false);
    this.singularBySlug = new Map(nodes.map((n) => [n.namePlural, n.nameSingular]));
    const objects = nodes.map(mapObject);
    this.metadataCache = objects;
    return objects;
  }

  private singularFor(object: ObjectMetadata): string {
    return this.singularBySlug.get(object.slug) ?? singularName(object);
  }

  private async resolveObject(slug: string): Promise<{
    object: ObjectMetadata;
    objectsBySlug: Map<string, ObjectMetadata>;
    nameSingular: string;
  }> {
    const objects = await this.loadObjects();
    const objectsBySlug = new Map(objects.map((o) => [o.slug, o]));
    const object = objectsBySlug.get(slug);
    if (!object) {
      throw new TwentyApiError(`unknown object "${slug}"`);
    }
    return { object, objectsBySlug, nameSingular: this.singularFor(object) };
  }

  async listObjects(): Promise<ActionResult<ObjectMetadata[]>> {
    try {
      const objects = await this.loadObjects();
      return { ok: true, data: objects };
    } catch (err) {
      return this.fail('listObjects', err);
    }
  }

  async listRecords(params: ListRecordsParams): Promise<ActionResult<RecordsPage>> {
    try {
      const { object, objectsBySlug, nameSingular } = await this.resolveObject(params.object);
      const namePlural = object.slug;
      const nameSingularCapitalized = capitalize(nameSingular);

      const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 50;
      const page = params.page && params.page > 0 ? params.page : 1;
      const offset = (page - 1) * pageSize;

      const selection = buildRecordSelection(object, objectsBySlug);
      const filter = buildFilter(object, params);
      const orderBy = buildOrderBy(params);

      const query = /* GraphQL */ `
        query SabCrmFindMany${capitalize(namePlural)}(
          $filter: ${nameSingularCapitalized}FilterInput
          $orderBy: [${nameSingularCapitalized}OrderByInput]
          $first: Int
          $offset: Int
        ) {
          ${namePlural}(filter: $filter, orderBy: $orderBy, first: $first, offset: $offset) ${connectionSelection(selection)}
        }
      `;

      const data = await twentyFetch<RecordConnectionResult>(
        query,
        { filter, orderBy, first: pageSize, offset },
        await this.requestCtx(),
      );

      const connection = data[namePlural];
      const records = (connection?.edges ?? []).map((e) => mapRecordNode(e.node));
      const total = connection?.totalCount ?? records.length;
      return { ok: true, data: { records, total } };
    } catch (err) {
      return this.fail('listRecords', err);
    }
  }

  async getRecord(object: string, id: string): Promise<ActionResult<CrmRecord | null>> {
    try {
      const { object: meta, objectsBySlug, nameSingular } = await this.resolveObject(object);
      const selection = buildRecordSelection(meta, objectsBySlug);

      const query = /* GraphQL */ `
        query SabCrmFindOne${capitalize(nameSingular)}($id: UUID!) {
          ${nameSingular}(filter: { id: { eq: $id } }) ${selection}
        }
      `;

      const data = await twentyFetch<Record<string, Record<string, unknown> | null>>(
        query,
        { id },
        await this.requestCtx(),
      );
      const node = data[nameSingular];
      return { ok: true, data: node ? mapRecordNode(node) : null };
    } catch (err) {
      return this.fail('getRecord', err);
    }
  }

  async createRecord(
    object: string,
    data: Record<string, unknown>,
  ): Promise<ActionResult<CrmRecord>> {
    try {
      const { object: meta, objectsBySlug, nameSingular } = await this.resolveObject(object);
      const capitalized = capitalize(nameSingular);
      const selection = buildRecordSelection(meta, objectsBySlug);
      const responseField = `create${capitalized}`;

      const mutation = /* GraphQL */ `
        mutation SabCrmCreateOne${capitalized}($input: ${capitalized}CreateInput!) {
          ${responseField}(data: $input) ${selection}
        }
      `;

      const result = await twentyFetch<Record<string, Record<string, unknown>>>(
        mutation,
        { input: data },
        await this.requestCtx(),
      );
      return { ok: true, data: mapRecordNode(result[responseField]) };
    } catch (err) {
      return this.fail('createRecord', err);
    }
  }

  async updateRecord(
    object: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<ActionResult<CrmRecord>> {
    try {
      const { object: meta, objectsBySlug, nameSingular } = await this.resolveObject(object);
      const capitalized = capitalize(nameSingular);
      const selection = buildRecordSelection(meta, objectsBySlug);
      const responseField = `update${capitalized}`;

      const mutation = /* GraphQL */ `
        mutation SabCrmUpdateOne${capitalized}($id: UUID!, $input: ${capitalized}UpdateInput!) {
          ${responseField}(id: $id, data: $input) ${selection}
        }
      `;

      const result = await twentyFetch<Record<string, Record<string, unknown>>>(
        mutation,
        { id, input: patch },
        await this.requestCtx(),
      );
      return { ok: true, data: mapRecordNode(result[responseField]) };
    } catch (err) {
      return this.fail('updateRecord', err);
    }
  }

  async deleteRecord(object: string, id: string): Promise<ActionResult<{ ok: boolean }>> {
    try {
      const { nameSingular } = await this.resolveObject(object);
      const capitalized = capitalize(nameSingular);
      const responseField = `delete${capitalized}`;

      const mutation = /* GraphQL */ `
        mutation SabCrmDeleteOne${capitalized}($id: UUID!) {
          ${responseField}(id: $id) {
            id
          }
        }
      `;

      const result = await twentyFetch<Record<string, { id?: string } | null>>(
        mutation,
        { id },
        await this.requestCtx(),
      );
      const deleted = result[responseField];
      return { ok: true, data: { ok: Boolean(deleted?.id) } };
    } catch (err) {
      return this.fail('deleteRecord', err);
    }
  }
}

/**
 * Construct the Twenty-backed data layer for a workspace-scoped token.
 * Called by the C8 router when CRM_DATA_LAYER === 'twenty'.
 */
export function createTwentyCrmDataLayer(ctx: TwentyImplContext): CrmDataLayer {
  return new TwentyCrmDataLayer(ctx);
}

// ---------------------------------------------------------------------------
// Small string helpers (kept local to avoid pulling twenty-shared into SabNode).
// ---------------------------------------------------------------------------

function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Recover the GraphQL singular name from our ObjectMetadata. We persisted the
 * plural as `slug`; Twenty's record API addresses single records by the
 * singular name. We don't separately store the singular, so we derive it from
 * the singular label (lowercased, de-spaced) which equals Twenty's nameSingular
 * for standard objects. The metadata cache is keyed by plural slug, so this is
 * only ever called after a successful metadata load.
 */
function singularName(object: ObjectMetadata): string {
  // labelSingular for standard objects matches nameSingular case-insensitively
  // once spaces are stripped (e.g. "Opportunity" -> "opportunity").
  return object.labelSingular.replace(/\s+/g, '').replace(/^[A-Z]/, (c) => c.toLowerCase());
}

function connectionSelection(nodeSelection: string): string {
  return `{
  edges {
    node ${nodeSelection}
  }
  totalCount
}`;
}
