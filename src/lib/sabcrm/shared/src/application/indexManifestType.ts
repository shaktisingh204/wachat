import { type IndexFieldManifest } from './indexFieldManifestType';
import { type SyncableEntityOptions } from './syncableEntityOptionsType';

export type IndexManifest = SyncableEntityOptions & {
  objectUniversalIdentifier: string;
  indexType?: 'BTREE' | 'GIN';
  isUnique?: boolean;
  fields: IndexFieldManifest[];
};
