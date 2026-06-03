import { type ObjectFieldManifest } from './objectFieldManifest.type';
import { type SyncableEntityOptions } from './syncableEntityOptionsType';

export type ObjectManifest = SyncableEntityOptions & {
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
  description?: string;
  icon?: string;
  isSearchable?: boolean;
  fields: ObjectFieldManifest[];
  labelIdentifierFieldMetadataUniversalIdentifier: string;
};
