import { type MetadataEntityPropertyName } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/constant/all-entity-properties-configuration-by-metadata-name.constant';

export const FLAT_CONNECTION_PROVIDER_EDITABLE_PROPERTIES = [
  'displayName',
  'type',
  'oauthConfig',
] as const satisfies MetadataEntityPropertyName<'connectionProvider'>[];
