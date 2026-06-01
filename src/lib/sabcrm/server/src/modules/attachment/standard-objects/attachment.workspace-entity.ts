// PORT-NOTE: Adapted from twenty-server/src/modules/attachment/standard-objects/attachment.workspace-entity.ts
// The original extends BaseWorkspaceEntity (a TypeORM workspace entity).
// Here we export a plain TypeScript document type for MongoDB storage plus a
// typed collection accessor via SabNode's mongodb helper.

import "server-only";

import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

export type ActorMetadata = {
  source: string;
  workspaceMemberId: string | null;
  name: string | null;
};

export type FileOutput = {
  label: string | null;
  fileId: string | null;
  extension: string | null;
  url: string | null;
};

// ---------------------------------------------------------------------------
// Document type
// ---------------------------------------------------------------------------

export type AttachmentDocument = {
  _id: ObjectId;
  id: string;
  workspaceId: string;

  /** @deprecated Use `file[0].label` instead */
  name: string | null;

  file: FileOutput[] | null;

  /** @deprecated Use `file[0].fileId` instead */
  fullPath: string | null;

  /** @deprecated Use `fileCategory` instead */
  type: string | null;

  /** @deprecated Use `file[0].extension` instead */
  fileCategory: string;

  createdBy: ActorMetadata;
  updatedBy: ActorMetadata;

  // Relations stored as id references
  /** @deprecated */
  authorId: string | null;

  targetTaskId: string | null;
  targetNoteId: string | null;
  targetPersonId: string | null;
  targetCompanyId: string | null;
  targetOpportunityId: string | null;
  targetDashboardId: string | null;
  targetWorkflowId: string | null;

  // Custom workspace entity id reference
  customId: string | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

// ---------------------------------------------------------------------------
// Search field metadata (mirrors SEARCH_FIELDS_FOR_ATTACHMENT)
// ---------------------------------------------------------------------------

export const SEARCH_FIELDS_FOR_ATTACHMENT = [
  { name: "name", type: "TEXT" },
] as const;

// ---------------------------------------------------------------------------
// Collection accessor
// ---------------------------------------------------------------------------

export async function getAttachmentCollection() {
  const { db } = await connectToDatabase();
  return db.collection<AttachmentDocument>("sabcrm_attachment");
}
