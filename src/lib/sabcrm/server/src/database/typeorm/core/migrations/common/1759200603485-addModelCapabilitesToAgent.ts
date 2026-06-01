// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: core."agent" table — adds nullable "modelConfiguration" jsonb column.

/**
 * Migration 1759200603485 – AddNativeCapabilitesToAgent (AddModelCapabilitesToAgent)
 *
 * Postgres intent:
 *   UP:   ALTER TABLE core.agent ADD modelConfiguration jsonb;
 *   DOWN: ALTER TABLE core.agent DROP COLUMN modelConfiguration;
 *
 * Mongo equivalent:
 *   - sabcrm_agent documents gain an optional `modelConfiguration` object/document field.
 *   - No DDL required; Mongo is schema-less.
 */

export const migrationNote = {
  id: "1759200603485",
  name: "AddModelCapabilitesToAgent",
  mongoEquivalent:
    "No-op – sabcrm_agent documents gain optional modelConfiguration object field",
} as const;
