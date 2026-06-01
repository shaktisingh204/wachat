import "server-only";

import { type ObjectRecord } from "@/lib/sabcrm/shared/types";

import { ProcessNestedRelationsV2Helper, type FindOptionsRelations, type ObjectLiteral } from "@/lib/sabcrm/server/src/engine/api/common/common-nested-relations-processor/process-nested-relations-v2.helper";
import { type AggregationField } from "@/lib/sabcrm/server/src/engine/api/graphql/workspace-schema-builder/utils/get-available-aggregations-from-object-fields.util";
import { type WorkspaceAuthContext } from "@/lib/sabcrm/server/src/engine/core-modules/auth/types/workspace-auth-context.type";
import { FlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type";
import { FlatFieldMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type";
import { FlatObjectMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type";
import { GlobalWorkspaceDataSource } from "@/lib/sabcrm/server/src/engine/twenty-orm/global-workspace-datasource/global-workspace-datasource";
import { RolePermissionConfig } from "@/lib/sabcrm/server/src/engine/twenty-orm/types/role-permission-config";

// PORT-NOTE: NestJS @Injectable() / DI removed. Pass processNestedRelationsV2Helper explicitly.
export class ProcessNestedRelationsHelper {
  constructor(
    private readonly processNestedRelationsV2Helper: ProcessNestedRelationsV2Helper,
  ) {}

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
    return this.processNestedRelationsV2Helper.processNestedRelations({
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      parentObjectMetadataItem,
      parentObjectRecords,
      parentObjectRecordsAggregatedValues,
      relations,
      aggregate,
      limit,
      authContext,
      workspaceDataSource,
      rolePermissionConfig,
      selectedFields,
    });
  }
}
