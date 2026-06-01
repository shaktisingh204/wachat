// PORT-NOTE: This is a Postgres-only DDL migration (ALTER CONSTRAINT ... DEFERRABLE INITIALLY DEFERRED).
// MongoDB has no concept of deferrable foreign-key constraints. The underlying
// pageLayout collection in MongoDB simply stores the defaultTab reference as a
// plain ObjectId/string field — no FK enforcement exists and therefore no
// deferral configuration is needed.
//
// Original Twenty migration: SetPageLayoutDefaultTabDeferred1769679579383
//   UP:   ALTER TABLE "core"."pageLayout"
//           ALTER CONSTRAINT "FK_747fbc25827bdcb9e35cc68a990"
//           DEFERRABLE INITIALLY DEFERRED
//   DOWN: ALTER TABLE "core"."pageLayout"
//           ALTER CONSTRAINT "FK_747fbc25827bdcb9e35cc68a990"
//           NOT DEFERRABLE INITIALLY DEFERRED
//
// No Mongo index or seed action required.

export const migrationNote = {
  id: '1769679579383',
  name: 'SetPageLayoutDefaultTabDeferred',
  mongoAction: 'noop',
  reason:
    'Deferrable FK constraints are a Postgres-only concept; MongoDB enforces referential integrity at the application layer.',
} as const;
