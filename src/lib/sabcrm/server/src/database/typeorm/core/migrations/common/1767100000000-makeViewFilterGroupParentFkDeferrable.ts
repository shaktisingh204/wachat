// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration:
//   Makes the FK "parentViewFilterGroupId" on "core"."viewFilterGroup" DEFERRABLE INITIALLY DEFERRED.
//   This allows parent/child viewFilterGroup rows to be inserted in any order within a transaction.
//
// Mongo analogue:
//   MongoDB has no FK constraints, so there is nothing to defer.
//   The insertion-order problem this solves in Postgres does not exist in Mongo —
//   documents referencing parentViewFilterGroupId can be inserted in any order
//   without a constraint violation.
//
//   No index or seed action is needed. This migration is a pure no-op for Mongo.

export const migration1767100000000 = {
  name: "MakeViewFilterGroupParentFkDeferrable1767100000000",
  description:
    "PORT-NOTE: Pure Postgres DEFERRABLE FK migration. " +
    "MongoDB has no FK constraints; parent/child viewFilterGroup document insertion " +
    "order is already unconstrained. No Mongo action required.",
  up: async (): Promise<void> => {
    // No-op in Mongo.
  },
  down: async (): Promise<void> => {
    // No-op in Mongo.
  },
} as const;
