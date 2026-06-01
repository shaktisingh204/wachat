import 'server-only';

import { Collection, Document, ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import type { CommandMenuItemPayload } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/dtos/command-menu-item-payload.union';
import { CommandMenuItemAvailabilityType } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/enums/command-menu-item-availability-type.enum';
import { EngineComponentKey } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/enums/engine-component-key.enum';

// Mongo document type for the commandMenuItem collection.
// Preserves all TypeORM columns and relation id refs.
export type CommandMenuItemDocument = {
  _id?: ObjectId;
  /** UUID primary key */
  id: string;
  workflowVersionId: string | null;
  frontComponentId: string | null;
  engineComponentKey: EngineComponentKey;
  label: string;
  icon: string | null;
  shortLabel: string | null;
  position: number;
  isPinned: boolean;
  availabilityType: CommandMenuItemAvailabilityType;
  /** Stored as JSONB in Postgres; stored as embedded document in Mongo */
  payload: CommandMenuItemPayload | null;
  hotKeys: string[] | null;
  conditionalAvailabilityExpression: string | null;
  /** Relation id ref to objectMetadata document */
  availabilityObjectMetadataId: string | null;
  /** Relation id ref to pageLayout document */
  pageLayoutId: string | null;
  workspaceId: string;
  // SyncableEntity fields (universalIdentifier, applicationId, etc.) added as needed
  universalIdentifier?: string;
  applicationId?: string;
  createdAt: Date;
  updatedAt: Date;
};

// Mongo index equivalents (translated from TypeORM @Index/@Check):
// IDX_COMMAND_MENU_ITEM_WORKFLOW_VERSION_ID_WORKSPACE_ID:
//   { workflowVersionId: 1, workspaceId: 1 }
// IDX_COMMAND_MENU_ITEM_FRONT_COMPONENT_ID_WORKSPACE_ID:
//   { frontComponentId: 1, workspaceId: 1 }
// IDX_COMMAND_MENU_ITEM_AVAILABILITY_OBJECT_METADATA_ID:
//   { availabilityObjectMetadataId: 1 }
// IDX_COMMAND_MENU_ITEM_PAGE_LAYOUT_ID_WORKSPACE_ID:
//   { pageLayoutId: 1, workspaceId: 1 }
// CHK_CMD_MENU_ITEM_ENGINE_KEY_COHERENCE: enforce in application layer (not Mongo-native)
// These are created by the db-init/migration scripts.

const COLLECTION_NAME = 'sabcrm_command_menu_item';

export async function getCommandMenuItemCollection(): Promise<Collection<CommandMenuItemDocument & Document>> {
  const db = await connectToDatabase();
  return db.collection<CommandMenuItemDocument & Document>(COLLECTION_NAME);
}
