import "server-only";

// PORT-NOTE: @RegisteredInstanceCommand('1.23.0', 1775752190522) — pg-migration->mongo-index/seed
// Original: ALTER TYPE "core"."view_type_enum" ADD VALUE IF NOT EXISTS 'TABLE_WIDGET' AFTER 'FIELDS_WIDGET'
//
// Mongo analogue: Enum types do not exist in Mongo. The view type is stored as a
// string field. The TABLE_WIDGET value becomes valid automatically once application
// code starts writing it. No DDL or migration is required.
//
// The down() step (which removes the enum value by recreating the type) has no
// Mongo analogue; recorded here for documentation.

// PORT-NOTE: No runtime operation required for Mongo.
export async function up(): Promise<void> {
  // TABLE_WIDGET is now a valid value for sabcrm_view.type.
  // No collection modification needed.
}

export async function down(): Promise<void> {
  // PORT-NOTE: Removing an enum value in Postgres requires recreating the type.
  // In Mongo you would remove all documents that use type='TABLE_WIDGET', but
  // that is destructive and must be a conscious decision.
  // No-op here; handle manually if rollback is required.
}
