import { type SyncableEntityOptions } from './syncableEntityOptionsType';

export type IndexFieldManifest = SyncableEntityOptions & {
  fieldUniversalIdentifier: string;
  subFieldName?: string;
};
