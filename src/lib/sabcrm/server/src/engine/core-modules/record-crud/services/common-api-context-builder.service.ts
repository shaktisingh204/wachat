import 'server-only';

// PORT-NOTE: Ported from twenty-server CommonApiContextBuilderService.
// NestJS DI removed; service becomes plain exported functions.
// WorkspaceManyOrAllFlatEntityMapsCacheService, WorkspaceCacheService,
// UserRoleService, ApiKeyRoleService are not yet ported — the build() function
// accepts a pre-built context stub that callers can fill from the SabNode
// sabcrm DB layer (src/lib/sabcrm/objects.server.ts, records.server.ts).
//
// The full permission/role resolution (isApiKeyAuthContext, isUserAuthContext,
// isApplicationAuthContext) is preserved as logic but the backing service calls
// are stubbed until those modules are ported.

import {
  RecordCrudException,
  RecordCrudExceptionCode,
} from '../exceptions/record-crud.exception';
import {
  type FlatEntityMaps,
  type FlatFieldMetadata,
  type FlatObjectMetadata,
} from '../types/object-metadata-for-tool-schema.type';
import { type ObjectRecordProperties } from '../types/object-record-properties.type';
import { type RecordCrudExecutionContext } from '../types/record-crud-execution-context.type';

// Re-export FlatEntityMaps for consumers (mirrors the original CommonApiContext shape)
export type { FlatEntityMaps, FlatFieldMetadata, FlatObjectMetadata };

export type ObjectsPermissions = Record<
  string,
  { restrictedFields?: Record<string, boolean> }
>;

export type CommonSelectedFields = Record<string, boolean>;

export type CommonBaseQueryRunnerContext = {
  authContext: RecordCrudExecutionContext['authContext'];
  flatObjectMetadata: FlatObjectMetadata;
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  objectIdByNameSingular: Record<string, string>;
};

export type CommonApiContext = {
  queryRunnerContext: CommonBaseQueryRunnerContext;
  selectedFields: CommonSelectedFields;
  flatObjectMetadata: FlatObjectMetadata;
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  objectsPermissions: ObjectsPermissions;
};

// PORT-NOTE: In the original NestJS service the flat entity maps were retrieved
// from WorkspaceManyOrAllFlatEntityMapsCacheService.
// In SabNode those maps are built from the sabcrm metadata collections.
// Callers must supply pre-built FlatEntityMaps until the metadata cache
// module is ported. The function signature mirrors the original build() input.
export async function buildCommonApiContext({
  authContext,
  objectName,
  flatObjectMetadataMaps,
  flatFieldMetadataMaps,
  objectsPermissions = {},
}: {
  authContext: RecordCrudExecutionContext['authContext'];
  objectName: string;
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  objectsPermissions?: ObjectsPermissions;
}): Promise<CommonApiContext> {
  // Build name-to-id index from the flat maps
  const idByNameSingular: Record<string, string> = {};
  for (const [id, obj] of flatObjectMetadataMaps.byId.entries()) {
    idByNameSingular[obj.nameSingular] = id;
  }

  const objectId = idByNameSingular[objectName];
  if (!objectId) {
    throw new RecordCrudException(
      `Object ${objectName} not found`,
      RecordCrudExceptionCode.INVALID_REQUEST,
    );
  }

  const flatObjectMetadata = flatObjectMetadataMaps.byId.get(objectId);
  if (!flatObjectMetadata) {
    throw new RecordCrudException(
      `Object metadata for ${objectName} not found`,
      RecordCrudExceptionCode.INVALID_REQUEST,
    );
  }

  const restrictedFields =
    objectsPermissions[flatObjectMetadata.id]?.restrictedFields ?? {};

  // Build selectedFields: all non-restricted fields default to true
  const selectedFields: CommonSelectedFields = {};
  for (const [, field] of flatFieldMetadataMaps.byId.entries()) {
    if (!restrictedFields[field.name]) {
      selectedFields[field.name] = true;
    }
  }

  const queryRunnerContext: CommonBaseQueryRunnerContext = {
    authContext,
    flatObjectMetadata,
    flatObjectMetadataMaps,
    flatFieldMetadataMaps,
    objectIdByNameSingular: idByNameSingular,
  };

  return {
    queryRunnerContext,
    selectedFields,
    flatObjectMetadata,
    flatObjectMetadataMaps,
    flatFieldMetadataMaps,
    objectsPermissions,
  };
}
