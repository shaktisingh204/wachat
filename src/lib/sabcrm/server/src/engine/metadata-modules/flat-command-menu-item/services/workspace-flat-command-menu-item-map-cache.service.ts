import "server-only";

import { connectToDatabase } from '@/lib/mongodb';

import { type FlatCommandMenuItemMaps } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/types/flat-command-menu-item-maps.type';
import { fromCommandMenuItemEntityToFlatCommandMenuItem } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-command-menu-item/utils/from-command-menu-item-entity-to-flat-command-menu-item.util';
import { createEmptyFlatEntityMaps } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/constant/create-empty-flat-entity-maps.constant';
import { createIdToUniversalIdentifierMap } from 'src/lib/sabcrm/server/src/engine/workspace-cache/utils/create-id-to-universal-identifier-map.util';
import { addFlatEntityToFlatEntityMapsThroughMutationOrThrow } from 'src/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/utils/add-flat-entity-to-flat-entity-maps-through-mutation-or-throw.util';

/**
 * Computes the flat command-menu-item maps for a given workspace.
 * Replaces WorkspaceFlatCommandMenuItemMapCacheService.computeForCache()
 * (NestJS @Injectable, workspace-scoped repos, and TypeORM dropped — plain exported async function).
 */
export const computeFlatCommandMenuItemMapsForWorkspace = async (
  workspaceId: string,
): Promise<FlatCommandMenuItemMaps> => {
  const { db } = await connectToDatabase();

  const idAndUidProjection = { projection: { id: 1, universalIdentifier: 1 } };

  const [
    commandMenuItems,
    applications,
    objectMetadatas,
    frontComponents,
    pageLayouts,
  ] = await Promise.all([
    db
      .collection('sabcrm_command_menu_item')
      .find({ workspaceId })
      .toArray(),
    db
      .collection('sabcrm_application')
      .find({ workspaceId }, idAndUidProjection)
      .toArray(),
    db
      .collection('sabcrm_object_metadata')
      .find({ workspaceId }, idAndUidProjection)
      .toArray(),
    db
      .collection('sabcrm_front_component')
      .find({ workspaceId }, idAndUidProjection)
      .toArray(),
    db
      .collection('sabcrm_page_layout')
      .find({ workspaceId }, idAndUidProjection)
      .toArray(),
  ]);

  type IdAndUid = { id: string; universalIdentifier: string };

  const applicationIdToUniversalIdentifierMap = createIdToUniversalIdentifierMap(
    applications as IdAndUid[],
  );
  const objectMetadataIdToUniversalIdentifierMap = createIdToUniversalIdentifierMap(
    objectMetadatas as IdAndUid[],
  );
  const frontComponentIdToUniversalIdentifierMap = createIdToUniversalIdentifierMap(
    frontComponents as IdAndUid[],
  );
  const pageLayoutIdToUniversalIdentifierMap = createIdToUniversalIdentifierMap(
    pageLayouts as IdAndUid[],
  );

  const flatCommandMenuItemMaps = createEmptyFlatEntityMaps();

  for (const commandMenuItemEntity of commandMenuItems) {
    const flatCommandMenuItem = fromCommandMenuItemEntityToFlatCommandMenuItem({
      entity: commandMenuItemEntity as Parameters<
        typeof fromCommandMenuItemEntityToFlatCommandMenuItem
      >[0]['entity'],
      applicationIdToUniversalIdentifierMap,
      objectMetadataIdToUniversalIdentifierMap,
      frontComponentIdToUniversalIdentifierMap,
      pageLayoutIdToUniversalIdentifierMap,
    });

    addFlatEntityToFlatEntityMapsThroughMutationOrThrow({
      flatEntity: flatCommandMenuItem,
      flatEntityMapsToMutate: flatCommandMenuItemMaps,
    });
  }

  return flatCommandMenuItemMaps;
};
