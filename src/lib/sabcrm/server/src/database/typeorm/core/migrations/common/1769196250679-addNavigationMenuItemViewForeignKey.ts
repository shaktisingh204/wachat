// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration AddNavigationMenuItemViewForeignKey1769196250679
//
// What this migration did in Postgres (core schema):
//   UP:
//     - ALTER TABLE core."navigationMenuItem" ADD CONSTRAINT "FK_9ec9d8bc9bb4197be12d4efcaf3"
//         FOREIGN KEY ("viewId") REFERENCES core."view"("id") ON DELETE CASCADE ON UPDATE NO ACTION
//   DOWN:
//     - DROP CONSTRAINT "FK_9ec9d8bc9bb4197be12d4efcaf3"
//
// Mongo equivalent:
//   The sabcrm_navigationMenuItem document already has viewId as an optional string reference field.
//   The FK cascade semantics (delete navigationMenuItems when view is deleted) must be enforced
//   in application logic when deleting from sabcrm_view:
//     db.sabcrm_navigationMenuItem.deleteMany({ viewId: deletedViewId, workspaceId });
//   No new index is needed — the (viewId, workspaceId) index was already created in migration
//   1768807499350-addNavigationMenuItemEntity.

export const MIGRATION_NAME = 'AddNavigationMenuItemViewForeignKey1769196250679';
