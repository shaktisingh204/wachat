import 'server-only';

import { cache } from 'react';

import { twentyFetch, type TwentyRequestContext } from '@/lib/data-layer/twenty-client';
import { resolveCrmDataLayerKind } from '@/lib/data-layer/router';
import type {
  FieldMetadata,
  FieldOption,
  FieldRelation,
  FieldType,
  ObjectMetadata,
} from '@/lib/sabcrm/types';

/**
 * LANE 3 — Twenty metadata loader (server-only).
 *
 * Fetches twenty-server's objectMetadata + fieldMetadata graph (via the C5
 * `twentyFetch` client against the `/metadata` GraphQL endpoint) and maps EVERY
 * object + field + relation + select-option into SabCRM's {@link ObjectMetadata}
 * / {@link FieldMetadata} shape, so the native SabCRM pages can render Twenty's
 * schema dynamically — exactly the way the Rust path already does.
 *
 * Everything here is GATED behind `CRM_DATA_LAYER` (default `"rust"`). When the
 * flag is not `"twenty"` the loaders return an empty list rather than touching
 * the network, so default behaviour is completely unchanged and no caller can
 * accidentally hit twenty-server before cutover (PLAN.md Phase 4/5).
 *
 * Pure mapping + fetch. No other files are touched and no state is persisted.
 */

// ---------------------------------------------------------------------------
// Raw twenty-server GraphQL shapes (mirrors twenty-front's metadata fragment +
// the server DTOs in
// services/sabcrm/.../engine/metadata-modules/{object,field}-metadata/dtos).
// ---------------------------------------------------------------------------

/** Twenty's `FieldMetadataType` enum (twenty-shared/types/FieldMetadataType). */
type TwentyFieldType =
  | 'ACTOR'
  | 'ADDRESS'
  | 'ARRAY'
  | 'BOOLEAN'
  | 'CURRENCY'
  | 'DATE'
  | 'DATE_TIME'
  | 'EMAILS'
  | 'FILES'
  | 'FULL_NAME'
  | 'LINKS'
  | 'MORPH_RELATION'
  | 'MULTI_SELECT'
  | 'NUMBER'
  | 'NUMERIC'
  | 'PHONES'
  | 'POSITION'
  | 'RATING'
  | 'RAW_JSON'
  | 'RELATION'
  | 'RICH_TEXT'
  | 'SELECT'
  | 'TEXT'
  | 'TS_VECTOR'
  | 'UUID';

/** Option shape from `FieldMetadataComplexOption` (options.input.ts). */
interface TwentyFieldOption {
  id?: string;
  value: string;
  label: string;
  position?: number;
  color?: string;
}

/** `RelationType` (relation-type.interface.ts). */
type TwentyRelationType = 'ONE_TO_MANY' | 'MANY_TO_ONE';

/** Subset of `RelationDTO` we request (relation.dto.ts). */
interface TwentyRelation {
  type: TwentyRelationType;
  targetObjectMetadata: {
    id: string;
    nameSingular: string;
    namePlural: string;
  } | null;
  targetFieldMetadata: {
    id: string;
    name: string;
  } | null;
}

/** Subset of `FieldMetadataDTO` (field-metadata.dto.ts). */
interface TwentyField {
  id: string;
  type: TwentyFieldType;
  name: string;
  label: string;
  description?: string | null;
  icon?: string | null;
  isCustom?: boolean | null;
  isActive?: boolean | null;
  isSystem?: boolean | null;
  isUIReadOnly?: boolean | null;
  isNullable?: boolean | null;
  defaultValue?: unknown;
  options?: TwentyFieldOption[] | null;
  relation?: TwentyRelation | null;
}

/** Subset of `ObjectMetadataDTO` (object-metadata.dto.ts). */
interface TwentyObject {
  id: string;
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
  description?: string | null;
  icon?: string | null;
  isCustom?: boolean | null;
  isActive?: boolean | null;
  isSystem?: boolean | null;
  labelIdentifierFieldMetadataId?: string | null;
  fieldsList: TwentyField[];
}

interface ObjectMetadataItemsQuery {
  objects: {
    edges: Array<{ node: TwentyObject }>;
  };
}

// Mirrors twenty-front's OBJECT_METADATA_FRAGMENT + FIND_MANY_OBJECT_METADATA_ITEMS
// (modules/object-metadata/graphql/{fragment,queries}.ts), trimmed to the fields
// SabCRM's ObjectMetadata/FieldMetadata actually need.
const OBJECT_METADATA_QUERY = /* GraphQL */ `
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
          isCustom
          isActive
          isSystem
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
            isUIReadOnly
            isNullable
            defaultValue
            options
            relation {
              type
              targetObjectMetadata {
                id
                nameSingular
                namePlural
              }
              targetFieldMetadata {
                id
                name
              }
            }
          }
        }
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Field-type mapping: Twenty FieldMetadataType -> SabCRM FieldType union.
// ---------------------------------------------------------------------------

/**
 * Map a Twenty `FieldMetadataType` onto SabCRM's {@link FieldType}.
 *
 * Most names match 1:1. The deltas that need care:
 *  - `FILES`            -> our `FILE`
 *  - `RICH_TEXT`        -> our `RICH_TEXT_V2` (Twenty's v2 composite)
 *  - `MORPH_RELATION`   -> our `RELATION` (we don't model morph separately)
 *  - `POSITION`         -> `NUMBER` (it's an ordering float)
 *  - `UUID` / `TS_VECTOR` -> `TEXT` (no first-class SabCRM type; render as text)
 */
function mapFieldType(twentyType: TwentyFieldType): FieldType {
  switch (twentyType) {
    case 'TEXT':
      return 'TEXT';
    case 'NUMBER':
      return 'NUMBER';
    case 'NUMERIC':
      return 'NUMERIC';
    case 'POSITION':
      return 'NUMBER';
    case 'CURRENCY':
      return 'CURRENCY';
    case 'BOOLEAN':
      return 'BOOLEAN';
    case 'DATE':
      return 'DATE';
    case 'DATE_TIME':
      return 'DATE_TIME';
    case 'SELECT':
      return 'SELECT';
    case 'MULTI_SELECT':
      return 'MULTI_SELECT';
    case 'RATING':
      return 'RATING';
    case 'RELATION':
    case 'MORPH_RELATION':
      return 'RELATION';
    case 'FILES':
      return 'FILE';
    case 'FULL_NAME':
      return 'FULL_NAME';
    case 'ADDRESS':
      return 'ADDRESS';
    case 'EMAILS':
      return 'EMAILS';
    case 'PHONES':
      return 'PHONES';
    case 'LINKS':
      return 'LINKS';
    case 'ARRAY':
      return 'ARRAY';
    case 'RAW_JSON':
      return 'RAW_JSON';
    case 'ACTOR':
      return 'ACTOR';
    case 'RICH_TEXT':
      return 'RICH_TEXT_V2';
    case 'UUID':
    case 'TS_VECTOR':
      return 'TEXT';
    default: {
      // Exhaustiveness guard: anything new from Twenty degrades to TEXT.
      return 'TEXT';
    }
  }
}

/** Field types we never surface to native pages (internal / non-renderable). */
const HIDDEN_FIELD_TYPES = new Set<TwentyFieldType>([
  'TS_VECTOR',
  'POSITION',
]);

// ---------------------------------------------------------------------------
// Mapping helpers.
// ---------------------------------------------------------------------------

function mapOptions(options?: TwentyFieldOption[] | null): FieldOption[] | undefined {
  if (!options || options.length === 0) return undefined;
  return [...options]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((option) => {
      const mapped: FieldOption = {
        value: option.value,
        label: option.label,
      };
      if (option.color) mapped.color = option.color;
      return mapped;
    });
}

function mapRelation(
  relation: TwentyRelation | null | undefined,
): FieldRelation | undefined {
  if (!relation?.targetObjectMetadata) return undefined;
  const mapped: FieldRelation = {
    // Slug = Twenty's camelCase namePlural, our object slug convention.
    targetObject: relation.targetObjectMetadata.namePlural,
    kind: relation.type,
  };
  // The human label field on the target is filled in a second pass once every
  // object is known (see resolveRelationLabelFields).
  return mapped;
}

function mapField(field: TwentyField, labelIdentifierFieldId?: string | null): FieldMetadata {
  const type = mapFieldType(field.type);
  const mapped: FieldMetadata = {
    key: field.name,
    label: field.label,
    type,
  };

  if (field.icon) mapped.icon = field.icon;
  if (field.description) mapped.description = field.description;
  // Twenty models requiredness as `isNullable` (false => required).
  if (field.isNullable === false) mapped.required = true;
  if (labelIdentifierFieldId && field.id === labelIdentifierFieldId) {
    mapped.isLabel = true;
  }
  // System / UI-read-only fields are not user-editable.
  if (field.isSystem || field.isUIReadOnly) mapped.system = true;
  if (field.defaultValue !== undefined && field.defaultValue !== null) {
    mapped.defaultValue = field.defaultValue;
  }

  const options = mapOptions(field.options);
  if (options) mapped.options = options;

  const relation = mapRelation(field.relation);
  if (relation) mapped.relation = relation;

  return mapped;
}

/** Decide whether a field should appear as a default table column. */
function fieldDefaultsToTable(field: FieldMetadata): boolean {
  if (field.system) return false;
  switch (field.type) {
    // Heavy / composite / multi-value types stay out of the default table.
    case 'RICH_TEXT_V2':
    case 'RAW_JSON':
    case 'ARRAY':
    case 'ADDRESS':
    case 'FILE':
      return false;
    default:
      return true;
  }
}

function mapObject(object: TwentyObject): ObjectMetadata {
  const fields = object.fieldsList
    .filter((field) => field.isActive !== false)
    .filter((field) => !HIDDEN_FIELD_TYPES.has(field.type))
    .map((field) => mapField(field, object.labelIdentifierFieldMetadataId));

  for (const field of fields) {
    field.inTable = fieldDefaultsToTable(field);
  }

  // A board view is offered when there's a SELECT field to group by — the same
  // heuristic the Rust schema uses (e.g. Opportunities by stage).
  const groupByField = fields.find((field) => field.type === 'SELECT' && !field.system);

  const mapped: ObjectMetadata = {
    slug: object.namePlural,
    labelSingular: object.labelSingular,
    labelPlural: object.labelPlural,
    icon: object.icon ?? 'Circle',
    fields,
    views: groupByField ? ['table', 'board'] : ['table'],
    standard: object.isCustom === false ? true : undefined,
  };

  if (object.description) mapped.description = object.description;
  if (groupByField) mapped.board = { groupByField: groupByField.key };

  return mapped;
}

/**
 * Second pass: now that every object is mapped, resolve each RELATION field's
 * `labelField` to the human label field on its target object. We resolve via
 * the target object's `isLabel` field (its label identifier).
 */
function resolveRelationLabelFields(objects: ObjectMetadata[]): void {
  const bySlug = new Map(objects.map((object) => [object.slug, object]));
  for (const object of objects) {
    for (const field of object.fields) {
      if (!field.relation) continue;
      const target = bySlug.get(field.relation.targetObject);
      if (!target) continue;
      const labelField =
        target.fields.find((targetField) => targetField.isLabel) ??
        target.fields.find((targetField) => targetField.type === 'TEXT');
      if (labelField) field.relation.labelField = labelField.key;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

/**
 * Context for the metadata loaders: the C5 request context (bearer token +
 * optional base URL) minted by the C6 user bridge. `projectId` is optional and
 * only feeds the data-layer gate (per-project selection lands in Phase 5).
 */
export interface TwentyMetadataContext extends TwentyRequestContext {
  projectId?: string;
}

/**
 * Internal cached fetch+map. `cache()` dedupes per request (per React render),
 * keyed on the resolved arguments — token + baseUrl — so a single page render
 * hits twenty-server's metadata endpoint at most once.
 */
const loadTwentyObjects = cache(
  async (
    token: string,
    baseUrl: string | undefined,
    projectId: string | undefined,
  ): Promise<ObjectMetadata[]> => {
    // GATE: never touch the network unless the Twenty data layer is active.
    if (resolveCrmDataLayerKind(projectId) !== 'twenty') return [];

    const ctx: TwentyRequestContext = baseUrl ? { token, baseUrl } : { token };
    const data = await twentyFetch<ObjectMetadataItemsQuery>(
      OBJECT_METADATA_QUERY,
      undefined,
      ctx,
      'metadata',
    );

    const objects = (data.objects?.edges ?? [])
      .map((edge) => edge.node)
      .filter((object) => object.isActive !== false)
      .map(mapObject)
      .sort((a, b) => a.labelPlural.localeCompare(b.labelPlural));

    resolveRelationLabelFields(objects);
    return objects;
  },
);

/**
 * Load EVERY Twenty object (with mapped fields/relations/options) as SabCRM
 * {@link ObjectMetadata}. Cached per request.
 *
 * Returns `[]` when `CRM_DATA_LAYER` is not `"twenty"` (default), so the Rust
 * path is entirely undisturbed.
 */
export async function getTwentyObjects(
  ctx: TwentyMetadataContext,
): Promise<ObjectMetadata[]> {
  return loadTwentyObjects(ctx.token, ctx.baseUrl, ctx.projectId);
}

/**
 * Load a single Twenty object by its SabCRM slug (Twenty `namePlural`). Cached
 * per request (shares the cache with {@link getTwentyObjects}).
 *
 * Returns `null` when the slug is unknown or the Twenty data layer is inactive.
 */
export async function getTwentyObject(
  slug: string,
  ctx: TwentyMetadataContext,
): Promise<ObjectMetadata | null> {
  const objects = await loadTwentyObjects(ctx.token, ctx.baseUrl, ctx.projectId);
  return objects.find((object) => object.slug === slug) ?? null;
}
