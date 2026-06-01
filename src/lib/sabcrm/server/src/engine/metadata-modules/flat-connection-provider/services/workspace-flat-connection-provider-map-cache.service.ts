import 'server-only';

import { type FlatConnectionProviderMaps } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-connection-provider/types/flat-connection-provider-maps.type';
import { fromConnectionProviderEntityToFlatConnectionProvider } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-connection-provider/utils/from-connection-provider-entity-to-flat-connection-provider.util';
import { createEmptyFlatEntityMaps } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/constant/create-empty-flat-entity-maps.constant';
import { addFlatEntityToFlatEntityMapsThroughMutationOrThrow } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/utils/add-flat-entity-to-flat-entity-maps-through-mutation-or-throw.util';
import { createIdToUniversalIdentifierMap } from '@/lib/sabcrm/server/src/engine/workspace-cache/utils/create-id-to-universal-identifier-map.util';
import { connectToDatabase } from '@/lib/mongodb';

// PORT-NOTE: NestJS @Injectable() / @WorkspaceCache removed.
// WorkspaceCacheProvider base class has no Next.js equivalent — this becomes a
// plain async function returning FlatConnectionProviderMaps for a given workspaceId.

export async function computeFlatConnectionProviderMapsForCache(
  workspaceId: string,
): Promise<FlatConnectionProviderMaps> {
  const client = await connectToDatabase();
  const db = client.db();

  const [connectionProviders, applications] = await Promise.all([
    db
      .collection('sabcrm_connection_providers')
      .find({ workspaceId })
      .toArray(),
    db
      .collection('sabcrm_applications')
      .find({ workspaceId }, { projection: { _id: 0, id: 1, universalIdentifier: 1 } })
      .toArray(),
  ]);

  const applicationIdToUniversalIdentifierMap = createIdToUniversalIdentifierMap(
    applications as { id: string; universalIdentifier: string }[],
  );

  const flatConnectionProviderMaps = createEmptyFlatEntityMaps();

  for (const doc of connectionProviders) {
    // Normalise Mongo _id -> id
    const connectionProviderEntity = {
      ...doc,
      id: doc.id ?? String(doc._id),
      createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt as string),
      updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(doc.updatedAt as string),
    } as Parameters<typeof fromConnectionProviderEntityToFlatConnectionProvider>[0]['entity'];

    const flatConnectionProvider =
      fromConnectionProviderEntityToFlatConnectionProvider({
        entity: connectionProviderEntity,
        applicationIdToUniversalIdentifierMap,
      });

    addFlatEntityToFlatEntityMapsThroughMutationOrThrow({
      flatEntity: flatConnectionProvider,
      flatEntityMapsToMutate: flatConnectionProviderMaps as FlatConnectionProviderMaps,
    });
  }

  return flatConnectionProviderMaps as FlatConnectionProviderMaps;
}
