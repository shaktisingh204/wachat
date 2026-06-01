// PORT-NOTE: Postgres DDL migration — creates a new "core"."viewFieldGroup" table
// with indexes and FK constraints, and adds a nullable "viewFieldGroupId" FK
// column to "core"."viewField".
// In MongoDB this translates to a new sabcrm_viewfieldgroup collection with
// compound indexes, and a new optional field on sabcrm_viewfield documents.
//
// Original Twenty migration: AddViewFieldGroup1770818941843
//   UP:
//     CREATE TABLE "core"."viewFieldGroup" (workspaceId, universalIdentifier,
//       applicationId, id, name, position, isVisible, viewId, createdAt,
//       updatedAt, deletedAt)
//     CREATE UNIQUE INDEX IDX_e88d35... ON viewFieldGroup(workspaceId, universalIdentifier)
//     CREATE INDEX IDX_VIEW_FIELD_GROUP_VIEW_ID ON viewFieldGroup(viewId)
//     CREATE INDEX IDX_VIEW_FIELD_GROUP_WORKSPACE_ID_VIEW_ID ON viewFieldGroup(workspaceId, viewId)
//     ALTER TABLE "core"."viewField" ADD "viewFieldGroupId" uuid
//     ADD FK constraints (workspaceId→workspace, applicationId→application, viewId→view,
//       viewFieldGroupId→viewFieldGroup)
//   DOWN: reverses all of the above
//
// Mongo indexes to create on sabcrm_viewfieldgroup (run once):
//   db.sabcrm_viewfieldgroup.createIndex(
//     { workspaceId: 1, universalIdentifier: 1 },
//     { unique: true, name: "IDX_e88d35604c4445b16e682edb30" }
//   )
//   db.sabcrm_viewfieldgroup.createIndex(
//     { viewId: 1 },
//     { name: "IDX_VIEW_FIELD_GROUP_VIEW_ID" }
//   )
//   db.sabcrm_viewfieldgroup.createIndex(
//     { workspaceId: 1, viewId: 1 },
//     { name: "IDX_VIEW_FIELD_GROUP_WORKSPACE_ID_VIEW_ID" }
//   )
//
// New field on sabcrm_viewfield documents:
//   viewFieldGroupId?: string | null   (ref sabcrm_viewfieldgroup)

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

/** Ensures indexes exist for the viewFieldGroup collection and related queries. */
export async function ensureViewFieldGroupIndexes(): Promise<void> {
  const { db } = await connectToDatabase();

  const vfg = db.collection("sabcrm_viewfieldgroup");
  await Promise.all([
    vfg.createIndex(
      { workspaceId: 1, universalIdentifier: 1 },
      { unique: true, name: "IDX_e88d35604c4445b16e682edb30" },
    ),
    vfg.createIndex(
      { viewId: 1 },
      { name: "IDX_VIEW_FIELD_GROUP_VIEW_ID" },
    ),
    vfg.createIndex(
      { workspaceId: 1, viewId: 1 },
      { name: "IDX_VIEW_FIELD_GROUP_WORKSPACE_ID_VIEW_ID" },
    ),
  ]);
}

export const migrationNote = {
  id: '1770818941843',
  name: 'AddViewFieldGroup',
  mongoAction: 'create-collection + create-indexes + field-add',
  collections: ['sabcrm_viewfieldgroup', 'sabcrm_viewfield'],
  newCollections: ['sabcrm_viewfieldgroup'],
  indexes: [
    { collection: 'sabcrm_viewfieldgroup', fields: { workspaceId: 1, universalIdentifier: 1 }, unique: true },
    { collection: 'sabcrm_viewfieldgroup', fields: { viewId: 1 } },
    { collection: 'sabcrm_viewfieldgroup', fields: { workspaceId: 1, viewId: 1 } },
  ],
  fieldsAdded: [
    { collection: 'sabcrm_viewfield', name: 'viewFieldGroupId', type: 'string | null', default: null },
  ],
} as const;
