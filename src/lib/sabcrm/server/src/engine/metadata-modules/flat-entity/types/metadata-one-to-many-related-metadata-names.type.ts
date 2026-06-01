import { type AllMetadataName } from '@/lib/sabcrm/shared/metadata';

import { type ALL_ONE_TO_MANY_METADATA_RELATIONS } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/constant/all-one-to-many-metadata-relations.constant';

type ExtractMetadataNames<T> = {
  [K in keyof T]: T[K] extends { metadataName: infer M } ? M : never;
}[keyof T];

export type MetadataOneToManyRelatedMetadataNames<T extends AllMetadataName> =
  Extract<
    ExtractMetadataNames<(typeof ALL_ONE_TO_MANY_METADATA_RELATIONS)[T]>,
    AllMetadataName
  >;
