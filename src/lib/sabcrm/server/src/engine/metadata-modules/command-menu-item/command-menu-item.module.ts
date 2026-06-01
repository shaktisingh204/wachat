// PORT-NOTE: NestJS @Module -> registry/index re-exporting ported pieces.
// Original module wired:
//   providers: [CommandMenuItemService, CommandMenuItemResolver, CommandMenuItemGraphqlApiExceptionInterceptor,
//               WorkspaceMigrationGraphqlApiExceptionInterceptor]
//   imports:   [WorkspaceManyOrAllFlatEntityMapsCacheModule, WorkspaceMigrationModule,
//               ApplicationModule, FlatCommandMenuItemModule, FrontComponentModule,
//               FeatureFlagModule, I18nModule]
//   exports:   [CommandMenuItemService]

export { CommandMenuItemException, CommandMenuItemExceptionCode } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/command-menu-item.exception';
export { commandMenuItemActions } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/command-menu-item.resolver';
export { commandMenuItemService } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/command-menu-item.service';
export { withCommandMenuItemExceptionHandling } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/interceptors/command-menu-item-graphql-api-exception.interceptor';
