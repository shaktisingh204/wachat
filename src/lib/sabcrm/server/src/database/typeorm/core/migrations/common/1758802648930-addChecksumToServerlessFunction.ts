// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: core."serverlessFunction" table — adds nullable "checksum" text column.

/**
 * Migration 1758802648930 – AddChecksumToServerlessFunction
 *
 * Postgres intent:
 *   UP:   ALTER TABLE core.serverlessFunction ADD checksum text;
 *   DOWN: ALTER TABLE core.serverlessFunction DROP COLUMN checksum;
 *
 * Mongo equivalent:
 *   - sabcrm_serverlessFunction documents gain an optional `checksum` string field.
 *   - No DDL required; Mongo is schema-less.
 */

export const migrationNote = {
  id: "1758802648930",
  name: "AddChecksumToServerlessFunction",
  mongoEquivalent:
    "No-op – sabcrm_serverlessFunction documents gain optional checksum string field",
} as const;
