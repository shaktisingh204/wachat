// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: core."serverlessFunction" table — drops "layerVersion" integer and "latestVersionInputSchema" jsonb columns.

/**
 * Migration 1759931071049 – SetServerlessFunctionLayerNotNullable
 *
 * Postgres intent:
 *   UP:   ALTER TABLE core.serverlessFunction DROP COLUMN layerVersion;
 *         ALTER TABLE core.serverlessFunction DROP COLUMN latestVersionInputSchema;
 *   DOWN: ADD COLUMN latestVersionInputSchema jsonb; ADD COLUMN layerVersion integer.
 *
 * Mongo equivalent:
 *   - sabcrm_serverlessFunction documents should no longer include `layerVersion` or `latestVersionInputSchema`.
 *   - Schema-less Mongo requires no DDL.
 *   - One-off cleanup:
 *       db.sabcrm_serverlessFunction.updateMany({}, { $unset: { layerVersion: "", latestVersionInputSchema: "" } });
 */

export const migrationNote = {
  id: "1759931071049",
  name: "SetServerlessFunctionLayerNotNullable",
  mongoEquivalent:
    "No-op DDL – sabcrm_serverlessFunction drops layerVersion and latestVersionInputSchema fields",
} as const;
