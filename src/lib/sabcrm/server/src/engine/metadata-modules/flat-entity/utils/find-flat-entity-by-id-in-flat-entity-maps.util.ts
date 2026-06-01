import { type FlatEntityMaps } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';

export const findFlatEntityByIdInFlatEntityMaps = <T extends { id: string }>({
  flatEntityId,
  flatEntityMaps,
}: {
  flatEntityId: string;
  flatEntityMaps: FlatEntityMaps<T>;
}): T | undefined => {
  return flatEntityMaps.byId[flatEntityId];
};
