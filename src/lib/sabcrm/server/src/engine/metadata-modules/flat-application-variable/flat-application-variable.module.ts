// PORT-NOTE: NestJS Module → SabNode registry/index re-export.
// Original wired: TypeOrmModule for ApplicationEntity + ApplicationVariableEntity,
// WorkspaceManyOrAllFlatEntityMapsCacheModule, and WorkspaceFlatApplicationVariableMapCacheService.
// In SabNode there is no DI container — consumers import the service function directly.

export { computeFlatApplicationVariableMapsForWorkspace } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-application-variable/services/workspace-flat-application-variable-map-cache.service';
export type { FlatApplicationVariableMaps } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-application-variable/types/flat-application-variable-maps.type';
export type { FlatApplicationVariable } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-application-variable/types/flat-application-variable.type';
export { FLAT_APPLICATION_VARIABLE_EDITABLE_PROPERTIES } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-application-variable/constants/flat-application-variable-editable-properties.constant';
export { fromApplicationVariableEntityToFlatApplicationVariable } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-application-variable/utils/from-application-variable-entity-to-flat-application-variable.util';
