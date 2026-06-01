// PORT-NOTE: NestJS @Module() has no direct Next.js equivalent.
// This file re-exports the ported dataloader pieces so imports stay stable.
//
// Original NestJS module imported:
//   FieldMetadataModule, WorkspaceManyOrAllFlatEntityMapsCacheModule,
//   ApplicationRegistrationVariableModule
// and provided/exported: DataloaderService
//
// In Next.js: import DataloaderService (createLoaders) directly where needed.

export {
  createLoaders,
  type RelationLoaderPayload,
  type MorphRelationLoaderPayload,
  type FieldMetadataLoaderPayload,
  type IndexMetadataLoaderPayload,
  type IndexFieldMetadataLoaderPayload,
  type ObjectMetadataLoaderPayload,
  type ViewFieldGroupsByViewIdLoaderPayload,
  type ViewFieldsByViewFieldGroupIdLoaderPayload,
  type ViewFieldsByViewIdLoaderPayload,
  type ViewFiltersByViewIdLoaderPayload,
  type ViewSortsByViewIdLoaderPayload,
  type ViewGroupsByViewIdLoaderPayload,
  type ViewFilterGroupsByViewIdLoaderPayload,
  type IsConfiguredLoaderPayload,
} from "@/lib/sabcrm/server/src/engine/dataloaders/dataloader.service";

export type { IDataloaders } from "@/lib/sabcrm/server/src/engine/dataloaders/dataloader.interface";
