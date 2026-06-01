// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration creates "core"."skill" table with:
//   id, universalIdentifier, applicationId, workspaceId, standardId,
//   name, label, icon, description (text), content (text),
//   isCustom (bool, default false), isActive (bool, default true),
//   createdAt, updatedAt
//
// Indexes:
//   - UNIQUE (workspaceId, universalIdentifier)  sparse
//   - (id, isActive)
//   - UNIQUE (name, workspaceId) WHERE isActive = true  → partial unique
//
// Mongo analogue:
//   Create the three indexes on sabcrm_skill.
//   NOTE: MongoDB does not support partial unique indexes with a $where condition
//   using the filter `{ isActive: true }` directly in createIndex options (it does
//   since 4.x via partialFilterExpression). We model that below.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const migration1767003000000 = {
  name: "AddSkillEntity1767003000000",
  description:
    "Creates Mongo indexes for the sabcrm_skill collection: " +
    "compound unique sparse (workspaceId, universalIdentifier), " +
    "(id, isActive), and partial unique (name, workspaceId) where isActive=true.",

  up: async (): Promise<void> => {
    const { db } = await connectToDatabase();

    await db.collection("sabcrm_skill").createIndex(
      { workspaceId: 1, universalIdentifier: 1 },
      {
        unique: true,
        sparse: true,
        name: "IDX_skill_workspaceId_universalIdentifier",
      }
    );

    await db
      .collection("sabcrm_skill")
      .createIndex({ id: 1, isActive: 1 }, { name: "IDX_SKILL_ID_IS_ACTIVE" });

    // Partial unique index: unique (name, workspaceId) where isActive = true
    await db.collection("sabcrm_skill").createIndex(
      { name: 1, workspaceId: 1 },
      {
        unique: true,
        partialFilterExpression: { isActive: true },
        name: "IDX_SKILL_NAME_WORKSPACE_ID_UNIQUE",
      }
    );
  },

  down: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    for (const name of [
      "IDX_skill_workspaceId_universalIdentifier",
      "IDX_SKILL_ID_IS_ACTIVE",
      "IDX_SKILL_NAME_WORKSPACE_ID_UNIQUE",
    ]) {
      await db
        .collection("sabcrm_skill")
        .dropIndex(name)
        .catch(() => {
          /* ignore if absent */
        });
    }
  },
};
