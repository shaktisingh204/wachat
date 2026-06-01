// PORT-NOTE: pg-migration->mongo-index/seed
// Original:
//   1. Drop the old enum CHECK constraint.
//   2. Convert engineComponentKey column from ENUM to VARCHAR.
//   3. Drop the old ENUM type.
//   4. Back-fill TRIGGER_WORKFLOW_VERSION / FRONT_COMPONENT_RENDERER for docs that
//      have workflowVersionId / frontComponentId but no engineComponentKey.
//   5. Add new coherence CHECK constraint.
//   6. Make engineComponentKey NOT NULL.
//
// Mongo equivalent:
//   • engineComponentKey is already a plain string in Mongo — no type conversion.
//   • Back-fill the two new key values where the source foreign keys are set.
//   • Enforce NOT NULL by removing documents lacking the field.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export async function applyMigration1774363913813(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_commandMenuItem");

  // Back-fill TRIGGER_WORKFLOW_VERSION.
  await col.updateMany(
    {
      workflowVersionId: { $exists: true, $ne: null },
      $or: [
        { engineComponentKey: { $exists: false } },
        { engineComponentKey: null },
      ],
    },
    { $set: { engineComponentKey: "TRIGGER_WORKFLOW_VERSION" } },
  );

  // Back-fill FRONT_COMPONENT_RENDERER.
  await col.updateMany(
    {
      frontComponentId: { $exists: true, $ne: null },
      $or: [
        { engineComponentKey: { $exists: false } },
        { engineComponentKey: null },
      ],
    },
    { $set: { engineComponentKey: "FRONT_COMPONENT_RENDERER" } },
  );

  // Remove any remaining documents that still lack engineComponentKey
  // (mirrors the NOT NULL enforcement in Postgres).
  await col.deleteMany({
    $or: [
      { engineComponentKey: { $exists: false } },
      { engineComponentKey: null },
    ],
  });
}

/** Reversal: set engineComponentKey to null for TRIGGER/FRONT_COMPONENT docs. */
export async function rollbackMigration1774363913813(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_commandMenuItem");

  await col.updateMany(
    { engineComponentKey: "TRIGGER_WORKFLOW_VERSION" },
    { $set: { engineComponentKey: null } },
  );
  await col.updateMany(
    { engineComponentKey: "FRONT_COMPONENT_RENDERER" },
    { $set: { engineComponentKey: null } },
  );
}
