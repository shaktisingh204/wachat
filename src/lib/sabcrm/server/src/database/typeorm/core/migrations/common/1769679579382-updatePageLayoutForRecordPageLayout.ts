// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration UpdatePageLayoutForRecordPageLayout1769679579382
//
// What this migration did in Postgres (core schema):
//   UP:
//     - ALTER TABLE core."pageLayout" ADD "defaultTabToFocusOnMobileAndSidePanelId" uuid (nullable)
//     - ALTER TABLE core."pageLayoutTab" ADD "icon" varchar (nullable)
//     - CREATE TYPE core."pageLayoutTab_layoutmode_enum" AS ENUM('GRID','VERTICAL_LIST','CANVAS')
//     - ALTER TABLE core."pageLayoutTab" ADD "layoutMode" layoutmode_enum NOT NULL DEFAULT 'GRID'
//     - ALTER TABLE core."pageLayoutWidget" ADD "conditionalDisplay" jsonb (nullable)
//     - FK: pageLayout.defaultTabToFocusOnMobileAndSidePanelId -> pageLayoutTab.id ON DELETE SET NULL
//   DOWN: Reverts all of the above.
//
// Mongo equivalent:
//   sabcrm_pageLayout document type gains:
//     defaultTabToFocusOnMobileAndSidePanelId?: string
//   sabcrm_pageLayoutTab document type gains:
//     icon?: string
//     layoutMode: 'GRID' | 'VERTICAL_LIST' | 'CANVAS'  (default 'GRID')
//   sabcrm_pageLayoutWidget document type gains:
//     conditionalDisplay?: Record<string, unknown>
//   The SET NULL cascade on defaultTabToFocusOnMobileAndSidePanelId is enforced in app logic
//   when a pageLayoutTab is deleted.
//   No new indexes are needed for these changes.

export const MIGRATION_NAME = 'UpdatePageLayoutForRecordPageLayout1769679579382';

export type PageLayoutTabLayoutMode = 'GRID' | 'VERTICAL_LIST' | 'CANVAS';

export const PAGE_LAYOUT_TAB_LAYOUT_MODE_DEFAULT: PageLayoutTabLayoutMode = 'GRID';
