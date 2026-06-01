// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: core."application" table — renames column "label" -> "name".

/**
 * Migration 1759433496458 – RenameApplicationColumn
 *
 * Postgres intent:
 *   UP:   ALTER TABLE core.application RENAME COLUMN label TO name;
 *   DOWN: ALTER TABLE core.application RENAME COLUMN name TO label;
 *
 * Mongo equivalent:
 *   - sabcrm_application documents should use the field name `name` (not `label`).
 *   - No DDL required; Mongo is schema-less.
 *   - One-off document rename (run once):
 *       db.sabcrm_application.updateMany(
 *         { label: { $exists: true } },
 *         [{ $set: { name: "$label" } }, { $unset: "label" }]
 *       );
 */

export const migrationNote = {
  id: "1759433496458",
  name: "RenameApplicationColumn",
  mongoEquivalent:
    "field rename label->name in sabcrm_application; schema-less Mongo requires no DDL",
} as const;
