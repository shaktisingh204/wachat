import "server-only";

import { FieldMetadataType, type ObjectRecord } from "@/lib/sabcrm/shared/types";
import { isDefined } from "@/lib/sabcrm/shared/utils";

import { computeMorphOrRelationFieldJoinColumnName } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/utils/compute-morph-or-relation-field-join-column-name.util";
import { RelationType } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/interfaces/relation-type.interface";

import { STANDARD_ERROR_MESSAGE } from "@/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/standard-error-message.constant";
import {
  GraphqlQueryRunnerException,
  GraphqlQueryRunnerExceptionCode,
} from "@/lib/sabcrm/server/src/engine/api/graphql/graphql-query-runner/errors/graphql-query-runner.exception";
import { ProcessAggregateHelper } from "@/lib/sabcrm/server/src/engine/api/graphql/graphql-query-runner/helpers/process-aggregate.helper";
import { buildColumnsToSelect } from "@/lib/sabcrm/server/src/engine/api/graphql/graphql-query-runner/utils/build-columns-to-select";
import { getTargetObjectMetadataOrThrow } from "@/lib/sabcrm/server/src/engine/api/graphql/graphql-query-runner/utils/get-target-object-metadata.util";
import { type AggregationField } from "@/lib/sabcrm/server/src/engine/api/graphql/workspace-schema-builder/utils/get-available-aggregations-from-object-fields.util";
import { type WorkspaceAuthContext } from "@/lib/sabcrm/server/src/engine/core-modules/auth/types/workspace-auth-context.type";
import { FlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type";
import { findFlatEntityByIdInFlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util";
import { FlatFieldMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type";
import {
  buildFieldMapsFromFlatObjectMetadata,
  type FieldMapsForObject,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/utils/build-field-maps-from-flat-object-metadata.util";
import { FlatObjectMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type";
import { GlobalWorkspaceDataSource } from "@/lib/sabcrm/server/src/engine/twenty-orm/global-workspace-datasource/global-workspace-datasource";
import { type WorkspaceSelectQueryBuilder } from "@/lib/sabcrm/server/src/engine/twenty-orm/repository/workspace-select-query-builder";
import { type RolePermissionConfig } from "@/lib/sabcrm/server/src/engine/twenty-orm/types/role-permission-config";
import { isFieldMetadataEntityOfType } from "@/lib/sabcrm/server/src/engine/utils/is-field-metadata-of-type.util";

// PORT-NOTE: NestJS @Injectable() / DI removed. Exported as plain class.
// TypeORM FindOptionsRelations / ObjectLiteral are retained as plain TS types only.
export type FindOptionsRelations<T> = { [K in keyof T]?: boolean | FindOptionsRelations<T[K]> };
export type ObjectLiteral = Record<string, unknown>;

export class ProcessNestedRelationsV2Helper {
  public async processNestedRelations<T extends ObjectRecord = ObjectRecord>({
    flatObjectMetadataMaps,
    flatFieldMetadataMaps,
    parentObjectMetadataItem,
    parentObjectRecords,
    parentObjectRecordsAggregatedValues = {},
    relations,
    aggregate = {},
    limit,
    authContext,
    workspaceDataSource,
    rolePermissionConfig,
    selectedFields,
  }: {
    flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
    flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
    parentObjectMetadataItem: FlatObjectMetadata;
    parentObjectRecords: T[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parentObjectRecordsAggregatedValues?: Record<string, any>;
    relations: Record<string, FindOptionsRelations<ObjectLiteral>>;
    aggregate?: Record<string, AggregationField>;
    limit: number;
    authContext: WorkspaceAuthContext;
    workspaceDataSource: GlobalWorkspaceDataSource;
    rolePermissionConfig?: RolePermissionConfig;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedFields: Record<string, any>;
  }): Promise<void> {
    const processRelationTasks = Object.entries(relations).map(
      ([sourceFieldName, nestedRelations]) =>
        this.processRelation({
          flatObjectMetadataMaps,
          flatFieldMetadataMaps,
          parentObjectMetadataItem,
          parentObjectRecords,
          parentObjectRecordsAggregatedValues,
          sourceFieldName,
          nestedRelations,
          aggregate,
          limit,
          authContext,
          workspaceDataSource,
          rolePermissionConfig,
          selectedFields:
            selectedFields[sourceFieldName] instanceof Object
              ? selectedFields[sourceFieldName]
              : undefined,
        }),
    );

    await Promise.all(processRelationTasks);
  }

  private async processRelation<T extends ObjectRecord = ObjectRecord>({
    flatObjectMetadataMaps,
    flatFieldMetadataMaps,
    parentObjectMetadataItem,
    parentObjectRecords,
    parentObjectRecordsAggregatedValues,
    sourceFieldName,
    nestedRelations,
    aggregate,
    limit,
    authContext,
    workspaceDataSource,
    rolePermissionConfig,
    selectedFields,
  }: {
    flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
    flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
    parentObjectMetadataItem: FlatObjectMetadata;
    parentObjectRecords: T[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parentObjectRecordsAggregatedValues: Record<string, any>;
    sourceFieldName: string;
    nestedRelations: FindOptionsRelations<ObjectLiteral>;
    aggregate: Record<string, AggregationField>;
    limit: number;
    authContext: WorkspaceAuthContext;
    workspaceDataSource: GlobalWorkspaceDataSource;
    rolePermissionConfig?: RolePermissionConfig;
    selectedFields: Record<string, unknown>;
  }): Promise<void> {
    const fieldMaps = buildFieldMapsFromFlatObjectMetadata(
      flatFieldMetadataMaps,
      parentObjectMetadataItem,
    );

    const sourceFieldMetadata = findFlatEntityByIdInFlatEntityMaps({
      flatEntityId: fieldMaps.fieldIdByName[sourceFieldName],
      flatEntityMaps: flatFieldMetadataMaps,
    });

    if (!sourceFieldMetadata) {
      return;
    }

    if (
      !isFieldMetadataEntityOfType(
        sourceFieldMetadata,
        FieldMetadataType.RELATION,
      ) &&
      !isFieldMetadataEntityOfType(
        sourceFieldMetadata,
        FieldMetadataType.MORPH_RELATION,
      )
    ) {
      return;
    }

    if (!sourceFieldMetadata.settings) {
      throw new GraphqlQueryRunnerException(
        `Relation settings not found for field ${sourceFieldName}`,
        GraphqlQueryRunnerExceptionCode.RELATION_SETTINGS_NOT_FOUND,
        { userFriendlyMessage: STANDARD_ERROR_MESSAGE },
      );
    }

    const relationType = sourceFieldMetadata.settings?.relationType;
    const { targetRelationName, targetObjectMetadata, targetRelation } =
      this.getTargetObjectMetadata({
        flatObjectMetadataMaps,
        flatFieldMetadataMaps,
        parentObjectMetadataItem,
        sourceFieldName,
        fieldMaps,
      });

    const targetObjectRepository = workspaceDataSource.getRepository(
      targetObjectMetadata.nameSingular,
      rolePermissionConfig,
    );

    const targetObjectNameSingular = targetObjectMetadata.nameSingular;

    let targetObjectQueryBuilder = targetObjectRepository.createQueryBuilder(
      targetObjectNameSingular,
    );

    const columnsToSelect: Record<string, boolean> = buildColumnsToSelect({
      select: selectedFields,
      relations: nestedRelations,
      flatObjectMetadata: targetObjectMetadata,
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
    });

    if (relationType === RelationType.MANY_TO_ONE) {
      columnsToSelect.deletedAt = true;
      targetObjectQueryBuilder = targetObjectQueryBuilder.withDeleted();
    }

    targetObjectQueryBuilder = targetObjectQueryBuilder.setFindOptions({
      select: columnsToSelect,
    });

    const joinColumnName = computeMorphOrRelationFieldJoinColumnName({
      name: sourceFieldName,
    });

    const relationIds = this.getUniqueIds({
      records: parentObjectRecords,
      idField:
        relationType === RelationType.ONE_TO_MANY ? "id" : joinColumnName,
    });

    if (
      relationType === RelationType.ONE_TO_MANY &&
      !isDefined(targetRelationName)
    ) {
      throw new GraphqlQueryRunnerException(
        `Could not resolve target relation for one-to-many field ${sourceFieldName}`,
        GraphqlQueryRunnerExceptionCode.RELATION_TARGET_OBJECT_METADATA_NOT_FOUND,
        { userFriendlyMessage: STANDARD_ERROR_MESSAGE },
      );
    }

    const fieldMetadataTargetRelationColumnName =
      computeMorphOrRelationFieldJoinColumnName({
        name:
          targetRelation &&
          isFieldMetadataEntityOfType(
            targetRelation,
            FieldMetadataType.MORPH_RELATION,
          )
            ? targetRelation.name
            : (targetRelationName as string),
      });

    const { relationResults, relationAggregatedFieldsResult } =
      await this.findRelations({
        referenceQueryBuilder: targetObjectQueryBuilder,
        column:
          relationType === RelationType.ONE_TO_MANY
            ? `"${fieldMetadataTargetRelationColumnName}"`
            : "id",
        ids: relationIds,
        limit: limit * parentObjectRecords.length,
        aggregate,
        sourceFieldName,
        targetObjectNameSingular,
      });

    this.assignRelationResults({
      parentRecords: parentObjectRecords,
      parentObjectRecordsAggregatedValues,
      relationResults,
      relationAggregatedFieldsResult,
      sourceFieldName,
      joinField:
        relationType === RelationType.ONE_TO_MANY
          ? `${fieldMetadataTargetRelationColumnName}`
          : "id",
      joinColumnName,
      relationType,
      selectedFields,
    });

    if (Object.keys(nestedRelations).length > 0) {
      await this.processNestedRelations({
        flatObjectMetadataMaps,
        flatFieldMetadataMaps,
        parentObjectMetadataItem: targetObjectMetadata,
        parentObjectRecords: relationResults as ObjectRecord[],
        parentObjectRecordsAggregatedValues: relationAggregatedFieldsResult,
        relations: nestedRelations as Record<
          string,
          FindOptionsRelations<ObjectLiteral>
        >,
        aggregate,
        limit,
        authContext,
        workspaceDataSource,
        rolePermissionConfig,
        selectedFields,
      });
    }
  }

  private getTargetObjectMetadata({
    flatObjectMetadataMaps,
    flatFieldMetadataMaps,
    parentObjectMetadataItem,
    sourceFieldName,
    fieldMaps,
  }: {
    flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
    flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
    parentObjectMetadataItem: FlatObjectMetadata;
    sourceFieldName: string;
    fieldMaps: FieldMapsForObject;
  }) {
    const targetFieldMetadata = findFlatEntityByIdInFlatEntityMaps({
      flatEntityId: fieldMaps.fieldIdByName[sourceFieldName],
      flatEntityMaps: flatFieldMetadataMaps,
    });

    if (!targetFieldMetadata) {
      throw new GraphqlQueryRunnerException(
        `Field ${sourceFieldName} not found on object ${parentObjectMetadataItem.nameSingular}`,
        GraphqlQueryRunnerExceptionCode.FIELD_NOT_FOUND,
        { userFriendlyMessage: STANDARD_ERROR_MESSAGE },
      );
    }

    const targetObjectMetadata = getTargetObjectMetadataOrThrow(
      targetFieldMetadata,
      flatObjectMetadataMaps,
    );

    if (
      !targetFieldMetadata.relationTargetObjectMetadataId ||
      !targetFieldMetadata.relationTargetFieldMetadataId
    ) {
      throw new GraphqlQueryRunnerException(
        `Relation target object metadata id or field metadata id not found for field ${sourceFieldName}`,
        GraphqlQueryRunnerExceptionCode.RELATION_TARGET_OBJECT_METADATA_NOT_FOUND,
        { userFriendlyMessage: STANDARD_ERROR_MESSAGE },
      );
    }

    const targetRelation = findFlatEntityByIdInFlatEntityMaps({
      flatEntityId: targetFieldMetadata.relationTargetFieldMetadataId,
      flatEntityMaps: flatFieldMetadataMaps,
    });

    const targetRelationName = targetRelation?.name;

    return { targetRelationName, targetObjectMetadata, targetRelation };
  }

  private getUniqueIds({
    records,
    idField,
  }: {
    records: ObjectRecord[];
    idField: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): any[] {
    return [...new Set(records.map((item) => item[idField]))];
  }

  private async findRelations({
    referenceQueryBuilder,
    column,
    ids,
    limit,
    aggregate,
    sourceFieldName,
    targetObjectNameSingular,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    referenceQueryBuilder: WorkspaceSelectQueryBuilder<any>;
    column: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ids: any[];
    limit: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    aggregate: Record<string, any>;
    sourceFieldName: string;
    targetObjectNameSingular: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): Promise<{ relationResults: any[]; relationAggregatedFieldsResult: any }> {
    if (ids.length === 0) {
      return { relationResults: [], relationAggregatedFieldsResult: {} };
    }

    const aggregateForRelation = aggregate[sourceFieldName];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let relationAggregatedFieldsResult: Record<string, any> = {};

    if (aggregateForRelation) {
      const aggregateQueryBuilder = referenceQueryBuilder.clone();

      ProcessAggregateHelper.addSelectedAggregatedFieldsQueriesToQueryBuilder({
        selectedAggregatedFields: aggregateForRelation,
        queryBuilder: aggregateQueryBuilder,
        objectMetadataNameSingular: targetObjectNameSingular,
      });

      const aggregatedFieldsValues = await aggregateQueryBuilder
        .addSelect(column)
        .where(`${column} IN (:...ids)`, {
          ids,
        })
        .groupBy(column)
        .getRawMany();

      relationAggregatedFieldsResult = aggregatedFieldsValues.reduce(
        (acc: Record<string, unknown>, item: Record<string, unknown>) => {
          const columnWithoutQuotes = column.replace(/["']/g, "");
          const key = item[columnWithoutQuotes];
          const { [column]: _, ...itemWithoutColumn } = item;

          acc[key as string] = itemWithoutColumn;

          return acc;
        },
        {},
      );
    }

    const queryBuilderOptions = referenceQueryBuilder.getFindOptions();
    const columnWithoutQuotes = column.replace(/["']/g, "");

    const result = await referenceQueryBuilder
      .setFindOptions({
        ...queryBuilderOptions,
        select: { ...queryBuilderOptions.select, [columnWithoutQuotes]: true },
      })
      .where(`${column} IN (:...ids)`, {
        ids,
      })
      .take(limit)
      .getMany();

    return { relationResults: result, relationAggregatedFieldsResult };
  }

  private assignRelationResults({
    parentRecords,
    parentObjectRecordsAggregatedValues,
    relationResults,
    relationAggregatedFieldsResult,
    sourceFieldName,
    joinField,
    joinColumnName,
    relationType,
    selectedFields,
  }: {
    parentRecords: ObjectRecord[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parentObjectRecordsAggregatedValues: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    relationResults: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    relationAggregatedFieldsResult: Record<string, any>;
    sourceFieldName: string;
    joinField: string;
    joinColumnName: string;
    relationType: RelationType;
    selectedFields: Record<string, unknown>;
  }): void {
    parentRecords.forEach((item) => {
      if (relationType === RelationType.ONE_TO_MANY) {
        item[sourceFieldName] = relationResults.filter(
          (rel) => rel[joinField] === item.id,
        );
      } else {
        const matchedRelation = relationResults.find(
          (rel) => rel.id === item[joinColumnName],
        );

        if (isDefined(matchedRelation?.deletedAt)) {
          item[sourceFieldName] = null;
          item[joinColumnName] = null;
        } else if (isDefined(matchedRelation)) {
          if (selectedFields?.deletedAt !== true) {
            const { deletedAt: _, ...rest } = matchedRelation;

            item[sourceFieldName] = rest;
          } else {
            item[sourceFieldName] = matchedRelation;
          }
        } else {
          item[sourceFieldName] = null;
        }
      }
    });

    parentObjectRecordsAggregatedValues[sourceFieldName] =
      relationAggregatedFieldsResult;
  }
}
