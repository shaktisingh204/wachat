// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: core."serverlessFunction" table — makes "serverlessFunctionLayerId" NOT NULL
//         (drop + re-add FK against serverlessFunctionLayer).

/**
 * Migration 1761153071116 – SetServerlessFunctionLayerIdNotNullable
 *
 * Postgres intent:
 *   UP:   DROP CONSTRAINT FK_4b9625a4babf7f4fa942fd26514;
 *         ALTER TABLE core.serverlessFunction ALTER COLUMN serverlessFunctionLayerId SET NOT NULL;
 *         ADD CONSTRAINT FK_4b9625a4babf7f4fa942fd26514 FOREIGN KEY (serverlessFunctionLayerId)
 *           REFERENCES core.serverlessFunctionLayer(id) ON DELETE NO ACTION.
 *   DOWN: DROP CONSTRAINT; SET NULL; ADD CONSTRAINT.
 *
 * Mongo equivalent:
 *   - sabcrm_serverlessFunction documents must include `serverlessFunctionLayerId` (non-null).
 *   - Enforced at the Zod validation / application layer (required string field).
 *   - No DDL index changes required.
 *   - Verify no documents are missing the field:
 *       db.sabcrm_serverlessFunction.find({ serverlessFunctionLayerId: { $exists: false } })
 */

export const migrationNote = {
  id: "1761153071116",
  name: "SetServerlessFunctionLayerIdNotNullable",
  mongoEquivalent:
    "Application-layer Zod validation enforces serverlessFunctionLayerId as required; no DDL required",
} as const;
