// PORT-NOTE: NestJS module wiring. No Next.js equivalent — re-exports all CRUD service functions.
// Imports: CoreCommonApiModule, WorkspaceManyOrAllFlatEntityMapsCacheModule, WorkspaceCacheModule,
//          UserRoleModule, ApiKeyModule

export { buildCommonApiContext } from './services/common-api-context-builder.service';
export { createManyRecords } from './services/create-many-records.service';
export { createRecord } from './services/create-record.service';
export { deleteCrmRecord } from './services/delete-record.service';
export { findCrmRecords } from './services/find-records.service';
export { groupByCrmRecords } from './services/group-by-records.service';
export { updateManyCrmRecords } from './services/update-many-records.service';
export { updateCrmRecord } from './services/update-record.service';
export { upsertCrmRecord } from './services/upsert-record.service';
