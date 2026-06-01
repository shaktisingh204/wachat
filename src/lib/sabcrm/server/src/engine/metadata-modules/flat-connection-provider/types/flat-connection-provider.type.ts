import { type ConnectionProviderEntity } from '@/lib/sabcrm/server/src/engine/core-modules/application/connection-provider/connection-provider.entity';
import { type FlatEntityFrom } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/flat-entity-from.type';

export type FlatConnectionProvider = FlatEntityFrom<ConnectionProviderEntity>;
