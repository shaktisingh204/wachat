// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddWorkspaceForeignKeyToSearchFieldMetadata1757809958470
// Postgres:
//   up:   ALTER TABLE "core"."searchFieldMetadata"
//         ADD CONSTRAINT "FK_…" FOREIGN KEY ("workspaceId")
//         REFERENCES "core"."workspace"("id") ON DELETE CASCADE
//   down: DROP CONSTRAINT …
//
// In MongoDB foreign-key constraints do not exist. The "cascade delete"
// semantics must be enforced at the application layer. This migration is a
// no-op in MongoDB — a note is written to document the expected behaviour.

import 'server-only';

export const up = async (): Promise<void> => {
  // PORT-NOTE: No Mongo equivalent for FK constraints. Application code must
  // delete sabcrm_searchfieldmetadata documents when the parent workspace is
  // removed (cascade delete equivalent).
};

export const down = async (): Promise<void> => {
  // No-op — nothing was created in up().
};

export const migrationName =
  'AddWorkspaceForeignKeyToSearchFieldMetadata1757809958470';
