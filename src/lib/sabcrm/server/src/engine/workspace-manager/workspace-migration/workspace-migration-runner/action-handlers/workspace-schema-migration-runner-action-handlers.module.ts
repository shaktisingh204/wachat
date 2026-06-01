// PORT-NOTE: kind=module-wiring
// NestJS @Module has no Next.js / Mongo equivalent.
// This registry re-exports all action-handler service classes so
// consuming code can import from a single barrel without depending on NestJS DI.
// Instantiate handler classes directly where needed.

export { CreateViewFieldActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view-field/services/create-view-field-action-handler.service";
export { DeleteViewFieldActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view-field/services/delete-view-field-action-handler.service";
export { UpdateViewFieldActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view-field/services/update-view-field-action-handler.service";

export { CreateViewFilterGroupActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view-filter-group/services/create-view-filter-group-action-handler.service";
export { DeleteViewFilterGroupActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view-filter-group/services/delete-view-filter-group-action-handler.service";
export { UpdateViewFilterGroupActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view-filter-group/services/update-view-filter-group-action-handler.service";

export { CreateViewFilterActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view-filter/services/create-view-filter-action-handler.service";
export { DeleteViewFilterActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view-filter/services/delete-view-filter-action-handler.service";
export { UpdateViewFilterActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view-filter/services/update-view-filter-action-handler.service";

export { CreateViewGroupActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view-group/services/create-view-group-action-handler.service";
export { DeleteViewGroupActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view-group/services/delete-view-group-action-handler.service";
export { UpdateViewGroupActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view-group/services/update-view-group-action-handler.service";

export { CreateViewSortActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view-sort/services/create-view-sort-action-handler.service";
export { DeleteViewSortActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view-sort/services/delete-view-sort-action-handler.service";
export { UpdateViewSortActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view-sort/services/update-view-sort-action-handler.service";

export { CreateViewActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view/services/create-view-action-handler.service";
export { DeleteViewActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view/services/delete-view-action-handler.service";
export { UpdateViewActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view/services/update-view-action-handler.service";

export { CreateWebhookActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/webhook/services/create-webhook-action-handler.service";
export { DeleteWebhookActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/webhook/services/delete-webhook-action-handler.service";
export { UpdateWebhookActionHandlerService } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/webhook/services/update-webhook-action-handler.service";

// PORT-NOTE: The following handlers from the original NestJS module are ported in
// other batches (field, object, index, agent, skill, role, etc.) and will be
// separately importable from their own target paths.
// ApplicationEntity (TypeORM), WorkspaceSchemaManagerModule, SecretEncryptionModule
// have no Mongo equivalents — they are replaced by direct MongoDB collection access
// and SabNode's own auth/encryption utilities.
