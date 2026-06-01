// PORT-NOTE: Adapted from twenty-server/src/modules/blocklist/standard-objects/blocklist.workspace-entity.ts
// TypeORM workspace entity converted to a typed MongoDB document type plus
// a collection accessor.

import "server-only";

import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";

// ---------------------------------------------------------------------------
// Document type
// ---------------------------------------------------------------------------

export type BlocklistDocument = {
  _id: ObjectId;
  id: string;
  workspaceId: string;

  handle: string | null;

  // Relation stored as id reference (workspaceMember entity)
  workspaceMemberId: string;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

// ---------------------------------------------------------------------------
// Search field metadata (mirrors SEARCH_FIELDS_FOR_BLOCKLIST)
// ---------------------------------------------------------------------------

export const SEARCH_FIELDS_FOR_BLOCKLIST = [
  { name: "handle", type: "TEXT" },
] as const;

// ---------------------------------------------------------------------------
// Collection accessor
// ---------------------------------------------------------------------------

export async function getBlocklistCollection() {
  const { db } = await connectToDatabase();
  return db.collection<BlocklistDocument>("sabcrm_blocklist");
}
