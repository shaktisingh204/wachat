// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration MigrateServerlessTriggersToServerless1769532887284
//
// What this migration did in Postgres (core schema):
//   UP:
//     - ALTER TABLE core."serverlessFunction" ADD "cronTriggerSettings" jsonb (nullable)
//     - ALTER TABLE core."serverlessFunction" ADD "databaseEventTriggerSettings" jsonb (nullable)
//     - ALTER TABLE core."serverlessFunction" ADD "httpRouteTriggerSettings" jsonb (nullable)
//     - DROP TABLE IF EXISTS core."cronTrigger" CASCADE
//     - DROP TABLE IF EXISTS core."databaseEventTrigger" CASCADE
//     - DROP TABLE IF EXISTS core."routeTrigger" CASCADE
//   DOWN: Reverts by removing the three jsonb columns and recreating the three trigger tables.
//
// Mongo equivalent:
//   The sabcrm_serverlessFunction (later sabcrm_logicFunction) document type gains three optional fields:
//     cronTriggerSettings?: Record<string, unknown>
//     databaseEventTriggerSettings?: Record<string, unknown>
//     httpRouteTriggerSettings?: Record<string, unknown>
//   The collections sabcrm_cronTrigger, sabcrm_databaseEventTrigger, and sabcrm_routeTrigger
//   are deprecated — do not write new documents to them. Existing data should be migrated
//   into the parent logicFunction document as embedded settings.

export const MIGRATION_NAME = 'MigrateServerlessTriggersToServerless1769532887284';

/** Deprecated collections superseded by embedded settings on sabcrm_logicFunction. */
export const DEPRECATED_TRIGGER_COLLECTIONS = [
  'sabcrm_cronTrigger',
  'sabcrm_databaseEventTrigger',
  'sabcrm_routeTrigger',
] as const;
