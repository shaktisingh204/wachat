import "server-only";

// PORT-NOTE: Fast instance command — originally runs Postgres DDL via TypeORM QueryRunner.
// In SabNode (Mongo), the CREATE INDEX DDL has no direct equivalent.
// Exported as a documented stub so the 1:1 batch mapping holds.
// If a Postgres sidecar is used for SabCRM metadata, run the SQL there directly.

/**
 * Fast instance command: 1.21.0 / 1775129420309
 * Add index IDX_VIEW_FIELD_VIEW_FIELD_GROUP_ID on core.viewField (viewFieldGroupId)
 *
 * Postgres up:
 *   CREATE INDEX IF NOT EXISTS "IDX_VIEW_FIELD_VIEW_FIELD_GROUP_ID"
 *   ON "core"."viewField" ("viewFieldGroupId")
 *
 * Postgres down:
 *   DROP INDEX IF EXISTS "core"."IDX_VIEW_FIELD_VIEW_FIELD_GROUP_ID"
 */
export const ADD_VIEW_FIELD_GROUP_ID_INDEX_SQL = {
  up: `CREATE INDEX IF NOT EXISTS "IDX_VIEW_FIELD_VIEW_FIELD_GROUP_ID" ON "core"."viewField" ("viewFieldGroupId")`,
  down: `DROP INDEX IF EXISTS "core"."IDX_VIEW_FIELD_VIEW_FIELD_GROUP_ID"`,
} as const;

export const ADD_VIEW_FIELD_GROUP_ID_INDEX_META = {
  version: "1.21.0",
  timestamp: 1775129420309,
  name: "AddViewFieldGroupIdIndexOnViewFieldFastInstanceCommand",
} as const;
