// PORT-NOTE: NestJS Module → SabNode registry/index re-export.
// Original wired: TypeOrmModule for CommandMenuItemEntity, ApplicationEntity,
// ObjectMetadataEntity, FrontComponentEntity, PageLayoutEntity;
// WorkspaceManyOrAllFlatEntityMapsCacheModule;
// WorkspaceFlatCommandMenuItemMapCacheService; workspace-scoped repos.
// In SabNode there is no DI container — consumers import service functions directly.

export { computeFlatCommandMenuItemMapsForWorkspace } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/services/workspace-flat-command-menu-item-map-cache.service';
export type { FlatCommandMenuItemMaps } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/types/flat-command-menu-item-maps.type';
export type { FlatCommandMenuItem } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/types/flat-command-menu-item.type';
export { FLAT_COMMAND_MENU_ITEM_EDITABLE_PROPERTIES } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/constants/flat-command-menu-item-editable-properties.constant';
export { buildNavigationFlatCommandMenuItem } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/utils/build-navigation-flat-command-menu-item.util';
export { fromCommandMenuItemEntityToFlatCommandMenuItem } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/utils/from-command-menu-item-entity-to-flat-command-menu-item.util';
export { fromCreateCommandMenuItemInputToFlatCommandMenuItemToCreate } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/utils/from-create-command-menu-item-input-to-flat-command-menu-item-to-create.util';
export { fromDeleteCommandMenuItemInputToFlatCommandMenuItemOrThrow } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/utils/from-delete-command-menu-item-input-to-flat-command-menu-item-or-throw.util';
export { fromFlatCommandMenuItemToCommandMenuItemDto } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/utils/from-flat-command-menu-item-to-command-menu-item-dto.util';
export { fromUpdateCommandMenuItemInputToFlatCommandMenuItemToUpdateOrThrow } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/utils/from-update-command-menu-item-input-to-flat-command-menu-item-to-update-or-throw.util';
export { seedCompareObjectMetadataForNavigationPosition } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/utils/seed-compare-object-metadata-for-navigation-position.util';
