import "server-only";

// PORT-NOTE: NestJS @Command -> exported async function.
// TypeORM MessageFolderRepository.find + update -> MongoDB collection queries.
// Logic is preserved faithfully: for each folder whose parentFolderId looks like
// a UUID but is actually an internal id, replace it with the corresponding externalId.

import { connectToDatabase } from "@/lib/mongodb";

export type MigrateMessageFolderParentIdToExternalIdOptions = {
  workspaceId: string;
  dryRun?: boolean;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MessageFolderDoc = {
  id: string;
  workspaceId: string;
  parentFolderId?: string | null;
  externalId?: string | null;
};

/**
 * Workspace command: 1.21.0 / 1775500011000
 * Migrate messageFolder parentFolderId from internal UUID references to external IDs.
 */
export async function migrateMessageFolderParentIdToExternalId(
  options: MigrateMessageFolderParentIdToExternalIdOptions,
): Promise<void> {
  const { workspaceId, dryRun = false } = options;

  const { db } = await connectToDatabase();
  const col = db.collection<MessageFolderDoc>("sabcrm_message_folder");

  const folders = await col.find({ workspaceId }).toArray();

  const idToExternalIdMap = new Map<string, string>();
  const existingExternalIds = new Set<string>();

  for (const folder of folders) {
    if (folder.externalId) {
      idToExternalIdMap.set(folder.id, folder.externalId);
      existingExternalIds.add(folder.externalId);
    }
  }

  let migratedCount = 0;

  for (const folder of folders) {
    if (!folder.parentFolderId) {
      continue;
    }

    if (!UUID_REGEX.test(folder.parentFolderId)) {
      continue;
    }

    // Already points to a valid externalId — skip even if it looks like a UUID
    if (existingExternalIds.has(folder.parentFolderId)) {
      continue;
    }

    const parentExternalId = idToExternalIdMap.get(folder.parentFolderId);

    if (!parentExternalId) {
      console.warn(
        `Folder ${folder.id}: parent ${folder.parentFolderId} not found or has no externalId, setting to null`,
      );

      if (!dryRun) {
        await col.updateOne(
          { id: folder.id },
          { $set: { parentFolderId: null } },
        );
      }

      migratedCount++;
      continue;
    }

    if (dryRun) {
      console.log(
        `[DRY RUN] Would update folder ${folder.id}: parentFolderId ${folder.parentFolderId} -> ${parentExternalId}`,
      );
    } else {
      await col.updateOne(
        { id: folder.id },
        { $set: { parentFolderId: parentExternalId } },
      );
    }

    migratedCount++;
  }

  console.log(
    `${dryRun ? "[DRY RUN] " : ""}Migrated ${migratedCount} folder(s) for workspace ${workspaceId}`,
  );
}
