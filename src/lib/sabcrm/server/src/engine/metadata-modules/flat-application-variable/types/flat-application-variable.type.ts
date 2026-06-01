import { type FlatEntityFrom } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/flat-entity-from.type';
import { type ApplicationVariableEntity } from 'src/lib/sabcrm/server/src/engine/core-modules/application/application-variable/application-variable.entity';

export type FlatApplicationVariable = FlatEntityFrom<ApplicationVariableEntity>;
