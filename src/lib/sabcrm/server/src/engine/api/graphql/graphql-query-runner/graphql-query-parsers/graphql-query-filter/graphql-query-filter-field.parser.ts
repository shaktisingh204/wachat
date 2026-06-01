import "server-only";

// PORT-NOTE: Original used TypeORM WhereExpressionBuilder and Brackets.
// Ported to produce plain Mongo filter conditions (Record<string, unknown>).
// Composite field handling preserves sub-field traversal. Relation filter
// traversal is preserved but outputs Mongo $lookup-style hints; callers
// must apply join resolution separately.

import { compositeTypeDefinitions, RelationType } from "@/lib/sabcrm/shared/src/types";
import { capitalize, isDefined } from "@/lib/sabcrm/shared/src/utils";
import { type ObjectRecordFilter } from "@/lib/sabcrm/server/src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface";
import {
  GraphqlQueryRunnerException,
  GraphqlQueryRunnerExceptionCode,
} from "@/lib/sabcrm/server/src/engine/api/graphql/graphql-query-runner/errors/graphql-query-runner.exception";
import { type CompositeFieldMetadataType } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/types/composite-field-metadata-type.type";
import { isCompositeFieldMetadataType } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/utils/is-composite-field-metadata-type.util";
import { type FlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type";
import { findFlatEntityByIdInFlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util";
import { type FlatFieldMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type";
import { buildFieldMapsFromFlatObjectMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/utils/build-field-maps-from-flat-object-metadata.util";
import { isMorphOrRelationFlatFieldMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/utils/is-morph-or-relation-flat-field-metadata.util";
import { type FlatObjectMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type";
import { GraphqlQueryFilterConditionParser, type MongoCondition } from "./graphql-query-filter-condition.parser";

const MAX_RELATION_FILTER_DEPTH = 1;
const ARRAY_OPERATORS = ['in', 'contains', 'notContains'];

/**
 * Converts a single GraphQL filter operator + value into a Mongo condition fragment.
 */
function buildMongoConditionPart(
  operator: string,
  fieldPath: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any,
): MongoCondition {
  switch (operator) {
    case 'eq': return { [fieldPath]: { $eq: value } };
    case 'neq': return { [fieldPath]: { $ne: value } };
    case 'gt': return { [fieldPath]: { $gt: value } };
    case 'gte': return { [fieldPath]: { $gte: value } };
    case 'lt': return { [fieldPath]: { $lt: value } };
    case 'lte': return { [fieldPath]: { $lte: value } };
    case 'like': return { [fieldPath]: { $regex: value.replace(/%/g, '.*'), $options: 'i' } };
    case 'ilike': return { [fieldPath]: { $regex: value.replace(/%/g, '.*'), $options: 'i' } };
    case 'in': return { [fieldPath]: { $in: value } };
    case 'notIn': return { [fieldPath]: { $nin: value } };
    case 'isNull': return value ? { [fieldPath]: null } : { [fieldPath]: { $ne: null } };
    case 'contains': return { [fieldPath]: { $in: value } };
    case 'notContains': return { [fieldPath]: { $nin: value } };
    default: return { [fieldPath]: value };
  }
}

export class GraphqlQueryFilterFieldParser {
  private flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  private flatObjectMetadataMaps?: FlatEntityMaps<FlatObjectMetadata>;
  private fieldIdByName: Record<string, string>;
  private fieldIdByJoinColumnName: Record<string, string>;
  private depth: number;

  constructor(
    flatObjectMetadata: FlatObjectMetadata,
    flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>,
    flatObjectMetadataMaps?: FlatEntityMaps<FlatObjectMetadata>,
    depth = 0,
  ) {
    this.flatFieldMetadataMaps = flatFieldMetadataMaps;
    this.flatObjectMetadataMaps = flatObjectMetadataMaps;
    this.depth = depth;

    const fieldMaps = buildFieldMapsFromFlatObjectMetadata(
      flatFieldMetadataMaps,
      flatObjectMetadata,
    );

    this.fieldIdByName = fieldMaps.fieldIdByName;
    this.fieldIdByJoinColumnName = fieldMaps.fieldIdByJoinColumnName;
  }

  public parse(
    objectNameSingular: string,
    key: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filterValue: any,
  ): MongoCondition {
    const isFilterKeyARelation = isDefined(this.fieldIdByName[key]);
    const fieldMetadataId =
      this.fieldIdByName[`${key}`] || this.fieldIdByJoinColumnName[`${key}`];

    const fieldMetadata = findFlatEntityByIdInFlatEntityMaps({
      flatEntityId: fieldMetadataId,
      flatEntityMaps: this.flatFieldMetadataMaps,
    });

    if (!isDefined(fieldMetadata)) {
      throw new Error(`Field metadata not found for field: ${key}`);
    }

    if (
      isFilterKeyARelation &&
      isMorphOrRelationFlatFieldMetadata(fieldMetadata) &&
      fieldMetadata.settings?.relationType === RelationType.MANY_TO_ONE
    ) {
      return this.parseRelationSubFilter(
        objectNameSingular,
        fieldMetadata,
        filterValue,
      );
    }

    if (isCompositeFieldMetadataType(fieldMetadata.type)) {
      return this.parseCompositeFieldForFilter(
        fieldMetadata,
        objectNameSingular,
        filterValue,
      );
    }

    const [[operator, value]] = Object.entries(filterValue);

    if (
      ARRAY_OPERATORS.includes(operator) &&
      (!Array.isArray(value) || value.length === 0)
    ) {
      throw new GraphqlQueryRunnerException(
        `Invalid filter value for field ${key}. Expected non-empty array`,
        GraphqlQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
        { userFriendlyMessage: `Invalid filter value: "${value}"` },
      );
    }

    return buildMongoConditionPart(operator, key, value);
  }

  private parseRelationSubFilter(
    parentAlias: string,
    fieldMetadata: FlatFieldMetadata,
    filterValue: Partial<ObjectRecordFilter>,
  ): MongoCondition {
    if (this.depth >= MAX_RELATION_FILTER_DEPTH) {
      throw new GraphqlQueryRunnerException(
        `Relation filter nesting deeper than ${MAX_RELATION_FILTER_DEPTH} hop is not supported`,
        GraphqlQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
        { userFriendlyMessage: 'Relation filters can only traverse one relation deep' },
      );
    }

    if (!isDefined(this.flatObjectMetadataMaps)) {
      throw new GraphqlQueryRunnerException(
        `Relation filter on "${fieldMetadata.name}" requires object metadata maps`,
        GraphqlQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
        { userFriendlyMessage: 'Relation filter is not supported here' },
      );
    }

    if (!isDefined(fieldMetadata.relationTargetObjectMetadataId)) {
      throw new GraphqlQueryRunnerException(
        `Relation filter on "${fieldMetadata.name}" is missing a target object`,
        GraphqlQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
        { userFriendlyMessage: 'Relation filter is misconfigured' },
      );
    }

    const targetObjectMetadata =
      findFlatEntityByIdInFlatEntityMaps<FlatObjectMetadata>({
        flatEntityId: fieldMetadata.relationTargetObjectMetadataId,
        flatEntityMaps: this.flatObjectMetadataMaps,
      });

    if (!isDefined(targetObjectMetadata)) {
      throw new GraphqlQueryRunnerException(
        `Target object not found for relation "${fieldMetadata.name}"`,
        GraphqlQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
        { userFriendlyMessage: 'Relation filter is misconfigured' },
      );
    }

    const joinAlias = fieldMetadata.name;

    const childConditionParser = new GraphqlQueryFilterConditionParser(
      targetObjectMetadata,
      this.flatFieldMetadataMaps,
      this.flatObjectMetadataMaps,
      this.depth + 1,
    );

    const subCondition = childConditionParser.buildConditionFromFilter(
      joinAlias,
      filterValue,
    );

    // PORT-NOTE: In Mongo this becomes an $elemMatch or a $lookup; the exact
    // resolution depends on how relations are stored. Wrapped under the field name.
    return { [joinAlias]: { $elemMatch: subCondition } };
  }

  private parseCompositeFieldForFilter(
    fieldMetadata: FlatFieldMetadata,
    objectNameSingular: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fieldValue: any,
  ): MongoCondition {
    const compositeType = compositeTypeDefinitions.get(
      fieldMetadata.type as CompositeFieldMetadataType,
    );

    if (!compositeType) {
      throw new Error(
        `Composite type definition not found for type: ${fieldMetadata.type}`,
      );
    }

    const conditions: MongoCondition[] = [];

    for (const [subFieldKey, subFieldFilter] of Object.entries(fieldValue)) {
      const subFieldMetadata = compositeType.properties.find(
        (property) => property.name === subFieldKey,
      );

      if (!subFieldMetadata) {
        throw new Error(
          `Sub field metadata not found for composite type: ${fieldMetadata.type}`,
        );
      }

      const fullFieldName = `${fieldMetadata.name}${capitalize(subFieldKey)}`;
      const [[operator, value]] = Object.entries(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        subFieldFilter as Record<string, any>,
      );

      if (
        ARRAY_OPERATORS.includes(operator) &&
        (!Array.isArray(value) || value.length === 0)
      ) {
        throw new GraphqlQueryRunnerException(
          `Invalid filter value for field ${subFieldKey}. Expected non-empty array`,
          GraphqlQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
          { userFriendlyMessage: `Invalid filter value: "${value}"` },
        );
      }

      conditions.push(buildMongoConditionPart(operator, fullFieldName, value));
    }

    if (conditions.length === 0) return {};
    if (conditions.length === 1) return conditions[0];
    return { $and: conditions };
  }
}
