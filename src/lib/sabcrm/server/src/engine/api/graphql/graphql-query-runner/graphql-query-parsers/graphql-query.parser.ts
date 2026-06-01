import "server-only";

import { isNonEmptyString } from "@sniptt/guards";
import { isDefined } from "class-validator";
import { type OrderByWithGroupBy } from "@/lib/sabcrm/shared/types";

import {
  type ObjectRecordFilter,
  type ObjectRecordOrderBy,
} from "@/lib/sabcrm/server/src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface";

import { type GroupByField } from "@/lib/sabcrm/server/src/engine/api/common/common-query-runners/types/group-by-field.types";
import { GraphqlQueryFilterConditionParser } from "@/lib/sabcrm/server/src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query-filter/graphql-query-filter-condition.parser";
import { GraphqlQueryOrderGroupByParser } from "@/lib/sabcrm/server/src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query-order/graphql-query-order-group-by.parser";
import {
  GraphqlQueryOrderFieldParser,
  type OrderByClause,
  type RelationJoinInfo,
} from "@/lib/sabcrm/server/src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query-order/graphql-query-order.parser";
import {
  GraphqlQuerySelectedFieldsParser,
  type GraphqlQuerySelectedFieldsResult,
} from "@/lib/sabcrm/server/src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query-selected-fields/graphql-selected-fields.parser";
import { addRelationJoinAliasToQueryBuilder } from "@/lib/sabcrm/server/src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/utils/add-relation-join-alias.util";
import { type FlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type";
import { type FlatFieldMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type";
import { type FlatObjectMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type";
import { type WorkspaceSelectQueryBuilder } from "@/lib/sabcrm/server/src/engine/twenty-orm/repository/workspace-select-query-builder";

// PORT-NOTE: This class was originally a NestJS service using TypeORM query builders.
// In the SabNode/Mongo port, the TypeORM-specific query builder operations (orderBy,
// addSelect, withDeleted, leftJoin) are preserved as method signatures for compatibility
// but rely on the WorkspaceSelectQueryBuilder abstraction already ported.

export class GraphqlQueryParser {
  private flatObjectMetadata: FlatObjectMetadata;
  private flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  private flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  private filterConditionParser: GraphqlQueryFilterConditionParser;
  private orderFieldParser: GraphqlQueryOrderFieldParser;
  private orderGroupByParser: GraphqlQueryOrderGroupByParser;

  constructor(
    flatObjectMetadata: FlatObjectMetadata,
    flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>,
    flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>,
  ) {
    this.flatObjectMetadata = flatObjectMetadata;
    this.flatObjectMetadataMaps = flatObjectMetadataMaps;
    this.flatFieldMetadataMaps = flatFieldMetadataMaps;

    this.filterConditionParser = new GraphqlQueryFilterConditionParser(
      this.flatObjectMetadata,
      this.flatFieldMetadataMaps,
      this.flatObjectMetadataMaps,
    );
    this.orderFieldParser = new GraphqlQueryOrderFieldParser(
      this.flatObjectMetadata,
      this.flatObjectMetadataMaps,
      this.flatFieldMetadataMaps,
    );
    this.orderGroupByParser = new GraphqlQueryOrderGroupByParser(
      this.flatObjectMetadata,
      this.flatObjectMetadataMaps,
      this.flatFieldMetadataMaps,
    );
  }

  public applyFilterToBuilder(
    queryBuilder: WorkspaceSelectQueryBuilder<unknown>,
    objectNameSingular: string,
    recordFilter: Partial<ObjectRecordFilter>,
  ): WorkspaceSelectQueryBuilder<unknown> {
    return this.filterConditionParser.parse(
      queryBuilder,
      objectNameSingular,
      recordFilter,
    );
  }

  public applyDeletedAtToBuilder(
    queryBuilder: WorkspaceSelectQueryBuilder<unknown>,
    recordFilter: Partial<ObjectRecordFilter>,
  ): WorkspaceSelectQueryBuilder<unknown> {
    if (this.checkForDeletedAtFilter(recordFilter)) {
      queryBuilder.withDeleted();
    }

    return queryBuilder;
  }

  private checkForDeletedAtFilter = (
    filter: Record<string, unknown> | Record<string, unknown>[],
  ): boolean => {
    if (Array.isArray(filter)) {
      return filter.some((subFilter) =>
        this.checkForDeletedAtFilter(subFilter),
      );
    }

    for (const [key, value] of Object.entries(filter)) {
      if (key === "deletedAt") {
        return true;
      }

      // Only recurse into boolean-operator wrappers (and / or / not)
      if (
        (key === "and" || key === "or" || key === "not") &&
        typeof value === "object" &&
        value !== null &&
        this.checkForDeletedAtFilter(value as Record<string, unknown>)
      ) {
        return true;
      }
    }

    return false;
  };

  public applyOrderToBuilder(
    queryBuilder: WorkspaceSelectQueryBuilder<unknown>,
    orderBy: ObjectRecordOrderBy | OrderByWithGroupBy,
    objectNameSingular: string,
    isForwardPagination = true,
  ): Record<string, OrderByClause> {
    const parseResult = this.orderFieldParser.parse(
      orderBy as ObjectRecordOrderBy,
      objectNameSingular,
      isForwardPagination,
    );

    for (const joinInfo of parseResult.relationJoins) {
      addRelationJoinAliasToQueryBuilder({
        queryBuilder,
        parentAlias: objectNameSingular,
        relationName: joinInfo.joinAlias,
      });
    }

    queryBuilder.orderBy(parseResult.orderBy);

    return parseResult.orderBy;
  }

  public addRelationOrderColumnsToBuilder(
    queryBuilder: WorkspaceSelectQueryBuilder<unknown>,
    parsedOrderBy: Record<string, OrderByClause>,
    objectNameSingular: string,
    columnsToSelect: Record<string, boolean>,
  ): void {
    for (const orderByKey of Object.keys(parsedOrderBy)) {
      const parts = orderByKey.split(".");

      if (parts.length === 2) {
        const [alias, column] = parts;

        const isMainEntity = alias === objectNameSingular;
        const isAlreadySelected = isMainEntity && columnsToSelect[column];

        if (!isAlreadySelected) {
          queryBuilder.addSelect(
            `"${alias}"."${column}"`,
            `${alias}_${column}`,
          );
        }
      }
    }
  }

  public getOrderByRawSQL(
    orderBy: ObjectRecordOrderBy | OrderByWithGroupBy,
    objectNameSingular: string,
    isForwardPagination = true,
  ): { orderByRawSQL: string; relationJoins: RelationJoinInfo[] } {
    const parseResult = this.orderFieldParser.parse(
      orderBy as ObjectRecordOrderBy,
      objectNameSingular,
      isForwardPagination,
    );

    const orderByRawSQLClauseArray = Object.entries(parseResult.orderBy).map(
      ([orderByField, orderByCondition]) => {
        const nullsCondition = isDefined(orderByCondition.nulls)
          ? ` ${orderByCondition.nulls}`
          : "";

        const parts = orderByField.split(".");
        const quotedColumn =
          parts.length === 2
            ? `"${parts[0]}"."${parts[1]}"`
            : `"${orderByField}"`;

        let columnExpr = quotedColumn;

        if (orderByCondition.castToText) {
          columnExpr = `${columnExpr}::text`;
        }
        if (orderByCondition.useLower) {
          columnExpr = `LOWER(${columnExpr})`;
        }

        return `${columnExpr} ${orderByCondition.order}${nullsCondition}`;
      },
    );

    const orderByRawSQLString = orderByRawSQLClauseArray.join(", ");

    const orderByRawSQL = isNonEmptyString(orderByRawSQLString)
      ? `ORDER BY ${orderByRawSQLString}`
      : "";

    return { orderByRawSQL, relationJoins: parseResult.relationJoins };
  }

  public applyGroupByOrderToBuilder(
    queryBuilder: WorkspaceSelectQueryBuilder<unknown>,
    orderBy: ObjectRecordOrderBy | OrderByWithGroupBy,
    groupByFields: GroupByField[],
  ): WorkspaceSelectQueryBuilder<unknown> {
    const parsedOrderBys = this.orderGroupByParser.parse({
      orderBy,
      groupByFields,
    });

    parsedOrderBys.forEach((orderByField, index) => {
      Object.entries(orderByField).forEach(([expression, direction]) => {
        if (index === 0) {
          queryBuilder.orderBy(expression, direction.order, direction.nulls);
        } else {
          queryBuilder.addOrderBy(expression, direction.order, direction.nulls);
        }
      });
    });

    return queryBuilder;
  }

  public parseSelectedFields(
    graphqlSelectedFields: Partial<Record<string, unknown>>,
  ): GraphqlQuerySelectedFieldsResult {
    const selectedFieldsParser = new GraphqlQuerySelectedFieldsParser(
      this.flatObjectMetadataMaps,
      this.flatFieldMetadataMaps,
    );

    return selectedFieldsParser.parse(
      graphqlSelectedFields,
      this.flatObjectMetadata,
    );
  }
}
