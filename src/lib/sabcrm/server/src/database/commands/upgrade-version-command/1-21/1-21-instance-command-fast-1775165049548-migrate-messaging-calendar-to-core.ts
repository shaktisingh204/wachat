import "server-only";

// PORT-NOTE: Fast instance command — runs Postgres ALTER TABLE DDL via TypeORM QueryRunner.
// Changes messageFolder.parentFolderId column type from uuid to character varying.
// In SabNode (Mongo), this has no direct equivalent — field types in Mongo are schemaless.
// Exported as a documented stub so the 1:1 batch mapping holds.

/**
 * Fast instance command: 1.21.0 / 1775165049548
 * Migrate messageFolder.parentFolderId from uuid -> character varying
 *
 * Postgres up:
 *   ALTER TABLE "core"."messageFolder"
 *   ALTER COLUMN "parentFolderId" TYPE character varying
 *
 * Postgres down:
 *   ALTER TABLE "core"."messageFolder"
 *   ALTER COLUMN "parentFolderId" TYPE uuid USING "parentFolderId"::uuid
 *
 * Mongo note: parentFolderId is stored as a plain string in the sabcrm_message_folder
 * collection — no migration needed. This command is a no-op for Mongo.
 */
export const MIGRATE_MESSAGING_CALENDAR_TO_CORE_SQL = {
  up: `ALTER TABLE "core"."messageFolder" ALTER COLUMN "parentFolderId" TYPE character varying`,
  down: `ALTER TABLE "core"."messageFolder" ALTER COLUMN "parentFolderId" TYPE uuid USING "parentFolderId"::uuid`,
} as const;

export const MIGRATE_MESSAGING_CALENDAR_TO_CORE_META = {
  version: "1.21.0",
  timestamp: 1775165049548,
  name: "MigrateMessagingCalendarToCoreFastInstanceCommand",
} as const;
