import "server-only";

// PORT-NOTE: Original used TypeORM Brackets/WhereExpressionBuilder.
// In SabNode+Mongo those are replaced with plain filter condition builders.
// The structure (and/or/not/field dispatch) is preserved as a Mongo-oriented
// recursive condition tree builder. Callers convert the output to MongoDB filter objects.

import { type ObjectRecordFilter } from "@/lib/sabcrm/server/src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface";
import { type FlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type";
import { type FlatFieldMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type";
import { type FlatObjectMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type";
import { GraphqlQueryFilterFieldParser } from "./graphql-query-filter-field.parser";

export type MongoCondition = Record<string, unknown>;

export class GraphqlQueryFilterConditionParser {
  private flatObjectMetadata: FlatObjectMetadata;
  private queryFilterFieldParser: GraphqlQueryFilterFieldParser;

  constructor(
    flatObjectMetadata: FlatObjectMetadata,
    flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>,
    flatObjectMetadataMaps?: FlatEntityMaps<FlatObjectMetadata>,
    depth = 0,
  ) {
    this.flatObjectMetadata = flatObjectMetadata;
    this.queryFilterFieldParser = new GraphqlQueryFilterFieldParser(
      this.flatObjectMetadata,
      flatFieldMetadataMaps,
      flatObjectMetadataMaps,
      depth,
    );
  }

  public parse(
    objectNameSingular: string,
    filter: Partial<ObjectRecordFilter>,
  ): MongoCondition {
    if (!filter || Object.keys(filter).length === 0) {
      return {};
    }

    return this.buildConditionFromFilter(objectNameSingular, filter);
  }

  public buildConditionFromFilter(
    objectNameSingular: string,
    filter: Partial<ObjectRecordFilter>,
  ): MongoCondition {
    const conditions: MongoCondition[] = [];

    for (const [key, value] of Object.entries(filter)) {
      const condition = this.parseKeyFilter(objectNameSingular, key, value);
      if (condition && Object.keys(condition).length > 0) {
        conditions.push(condition);
      }
    }

    if (conditions.length === 0) return {};
    if (conditions.length === 1) return conditions[0];
    return { $and: conditions };
  }

  private parseKeyFilter(
    objectNameSingular: string,
    key: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
  ): MongoCondition {
    switch (key) {
      case 'and': {
        const subConditions = (value as ObjectRecordFilter[]).map((subFilter) =>
          this.buildConditionFromFilter(objectNameSingular, subFilter),
        );
        return { $and: subConditions };
      }
      case 'or': {
        const subConditions = (value as ObjectRecordFilter[]).map((subFilter) =>
          this.buildConditionFromFilter(objectNameSingular, subFilter),
        );
        return { $or: subConditions };
      }
      case 'not': {
        const subCondition = this.buildConditionFromFilter(
          objectNameSingular,
          value as Partial<ObjectRecordFilter>,
        );
        return { $nor: [subCondition] };
      }
      default:
        return this.queryFilterFieldParser.parse(
          objectNameSingular,
          key,
          value,
        );
    }
  }
}
