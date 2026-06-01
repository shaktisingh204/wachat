import { type AllMetadataName } from '@/lib/sabcrm/shared/metadata';

import { type MetadataManyToOneRelatedMetadataNames } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/metadata-many-to-one-related-metadata-names.type';
import { type MetadataToFlatEntityMapsKey } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/metadata-to-flat-entity-maps-key';

export type MetadataRelatedFlatEntityMapsKeys<T extends AllMetadataName> =
  MetadataToFlatEntityMapsKey<MetadataManyToOneRelatedMetadataNames<T>>;
