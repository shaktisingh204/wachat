// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: core."objectMetadata" table — adds nullable "applicationId" uuid column.

/**
 * Migration 1758720905726 – AddApplicationIdToObjectMetadata
 *
 * Postgres intent:
 *   UP:   ALTER TABLE core.objectMetadata ADD applicationId uuid;
 *   DOWN: ALTER TABLE core.objectMetadata DROP COLUMN applicationId;
 *
 * Mongo equivalent:
 *   - The sabcrm_objectMetadata collection documents should include an optional field
 *     `applicationId` (string/ObjectId referencing sabcrm_application).
 *   - No index is created here; see migration 1760700501795 which creates the compound
 *     (workspaceId, universalIdentifier) index and FK constraints for objectMetadata.
 *   - No DDL migration is needed; Mongo is schema-less.  New documents will carry the field;
 *     existing documents will simply lack it (treated as null/undefined by the application).
 */

export const migrationNote = {
  id: "1758720905726",
  name: "AddApplicationIdToObjectMetadata",
  mongoEquivalent:
    "No-op – sabcrm_objectMetadata documents gain optional applicationId field; schema-less Mongo requires no DDL",
} as const;
