import { type FlatEntityMaps } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatApplicationVariable } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-application-variable/types/flat-application-variable.type';

export type FlatApplicationVariableMaps =
  FlatEntityMaps<FlatApplicationVariable>;
