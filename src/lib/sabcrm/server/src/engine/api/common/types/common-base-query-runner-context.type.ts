import { type WorkspaceAuthContext } from '@/lib/sabcrm/server/src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type FlatEntityMaps } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatFieldMetadata } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';

export type CommonBaseQueryRunnerContext = {
  authContext: WorkspaceAuthContext;
  flatObjectMetadata: FlatObjectMetadata;
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  objectIdByNameSingular: Record<string, string>;
};
