// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration creates two new tables with FK constraints and indexes:
//   1. "core"."rowLevelPermissionPredicate"  (sabcrm_rowLevelPermissionPredicate)
//   2. "core"."rowLevelPermissionPredicateGroup" (sabcrm_rowLevelPermissionPredicateGroup)
//
// Indexes to create in Mongo:
//   rowLevelPermissionPredicate:
//     - UNIQUE  (workspaceId, universalIdentifier)  sparse
//     - (rowLevelPermissionPredicateGroupId)
//     - (fieldMetadataId)
//     - (workspaceId, roleId, objectMetadataId)
//
//   rowLevelPermissionPredicateGroup:
//     - UNIQUE  (workspaceId, universalIdentifier)  sparse
//     - (workspaceId, roleId)
//
// Operand enum values (for application-level validation):
export const ROW_LEVEL_PERMISSION_PREDICATE_OPERANDS = [
  "IS",
  "IS_NOT_NULL",
  "IS_NOT",
  "LESS_THAN_OR_EQUAL",
  "GREATER_THAN_OR_EQUAL",
  "IS_BEFORE",
  "IS_AFTER",
  "CONTAINS",
  "DOES_NOT_CONTAIN",
  "IS_EMPTY",
  "IS_NOT_EMPTY",
  "IS_RELATIVE",
  "IS_IN_PAST",
  "IS_IN_FUTURE",
  "IS_TODAY",
  "VECTOR_SEARCH",
] as const;

export type RowLevelPermissionPredicateOperand =
  (typeof ROW_LEVEL_PERMISSION_PREDICATE_OPERANDS)[number];

export const ROW_LEVEL_PERMISSION_PREDICATE_GROUP_LOGICAL_OPERATORS = [
  "AND",
  "OR",
] as const;

export type RowLevelPermissionPredicateGroupLogicalOperator =
  (typeof ROW_LEVEL_PERMISSION_PREDICATE_GROUP_LOGICAL_OPERATORS)[number];

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const migration1765499361805 = {
  name: "AddRLS1765499361805",
  description:
    "Creates Mongo indexes for sabcrm_rowLevelPermissionPredicate and sabcrm_rowLevelPermissionPredicateGroup.",

  up: async (): Promise<void> => {
    const { db } = await connectToDatabase();

    // ── rowLevelPermissionPredicate ──────────────────────────────────────────
    await db
      .collection("sabcrm_rowLevelPermissionPredicate")
      .createIndex(
        { workspaceId: 1, universalIdentifier: 1 },
        {
          unique: true,
          sparse: true,
          name: "IDX_RLPP_workspaceId_universalIdentifier",
        }
      );
    await db
      .collection("sabcrm_rowLevelPermissionPredicate")
      .createIndex(
        { rowLevelPermissionPredicateGroupId: 1 },
        { name: "IDX_RLPP_GROUP_ID" }
      );
    await db
      .collection("sabcrm_rowLevelPermissionPredicate")
      .createIndex(
        { fieldMetadataId: 1 },
        { name: "IDX_RLPP_FIELD_METADATA_ID" }
      );
    await db
      .collection("sabcrm_rowLevelPermissionPredicate")
      .createIndex(
        { workspaceId: 1, roleId: 1, objectMetadataId: 1 },
        { name: "IDX_RLPP_WORKSPACE_ID_ROLE_ID_OBJECT_METADATA_ID" }
      );

    // ── rowLevelPermissionPredicateGroup ─────────────────────────────────────
    await db
      .collection("sabcrm_rowLevelPermissionPredicateGroup")
      .createIndex(
        { workspaceId: 1, universalIdentifier: 1 },
        {
          unique: true,
          sparse: true,
          name: "IDX_RLPPG_workspaceId_universalIdentifier",
        }
      );
    await db
      .collection("sabcrm_rowLevelPermissionPredicateGroup")
      .createIndex(
        { workspaceId: 1, roleId: 1 },
        { name: "IDX_RLPPG_WORKSPACE_ID_ROLE_ID" }
      );
  },

  down: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    for (const name of [
      "IDX_RLPP_workspaceId_universalIdentifier",
      "IDX_RLPP_GROUP_ID",
      "IDX_RLPP_FIELD_METADATA_ID",
      "IDX_RLPP_WORKSPACE_ID_ROLE_ID_OBJECT_METADATA_ID",
    ]) {
      await db
        .collection("sabcrm_rowLevelPermissionPredicate")
        .dropIndex(name)
        .catch(() => {
          /* ignore if already absent */
        });
    }
    for (const name of [
      "IDX_RLPPG_workspaceId_universalIdentifier",
      "IDX_RLPPG_WORKSPACE_ID_ROLE_ID",
    ]) {
      await db
        .collection("sabcrm_rowLevelPermissionPredicateGroup")
        .dropIndex(name)
        .catch(() => {
          /* ignore if already absent */
        });
    }
  },
};
