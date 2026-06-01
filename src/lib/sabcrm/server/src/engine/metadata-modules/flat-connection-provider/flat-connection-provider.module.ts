// PORT-NOTE: NestJS Module → SabNode registry/index re-export.
// Original wired: TypeOrmModule for ConnectionProviderEntity + ApplicationEntity,
// WorkspaceManyOrAllFlatEntityMapsCacheModule, and WorkspaceFlatConnectionProviderMapCacheService.
// In SabNode there is no DI container — consumers import the service function directly.

export { computeFlatConnectionProviderMapsForWorkspace } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-connection-provider/services/workspace-flat-connection-provider-map-cache.service';
export { FLAT_CONNECTION_PROVIDER_EDITABLE_PROPERTIES } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-connection-provider/constants/flat-connection-provider-editable-properties.constant';
