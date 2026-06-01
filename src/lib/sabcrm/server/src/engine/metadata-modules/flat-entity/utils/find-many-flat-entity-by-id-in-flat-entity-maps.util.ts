import { type FlatEntityMaps } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { findFlatEntityByIdInFlatEntityMaps } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util';

export const findManyFlatEntityByIdInFlatEntityMaps = <T extends { id: string }>({
  flatEntityMaps,
  flatEntityIds,
}: {
  flatEntityMaps: FlatEntityMaps<T>;
  flatEntityIds: string[];
}): T[] => {
  return flatEntityIds
    .map((flatEntityId) =>
      findFlatEntityByIdInFlatEntityMaps({ flatEntityId, flatEntityMaps }),
    )
    .filter((entity): entity is T => entity !== undefined);
};
