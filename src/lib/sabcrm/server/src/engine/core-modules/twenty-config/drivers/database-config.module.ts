// PORT-NOTE: module-wiring — NestJS DynamicModule with TypeORM/ScheduleModule replaced by a
// plain factory function. Re-exports the pieces that the original module wired together so
// callers can construct the DatabaseConfigDriver without NestJS DI.

import { DatabaseConfigDriver } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/drivers/database-config.driver';
import { ConfigCacheService } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/cache/config-cache.service';
import { ConfigStorageService } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/storage/config-storage.service';
import { type ConfigVariables } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/config-variables';

export { DatabaseConfigDriver, ConfigCacheService, ConfigStorageService };

/**
 * createDatabaseConfigDriver wires the three services that DatabaseConfigModule.forRoot()
 * originally wired via NestJS DI.  The caller is responsible for passing a MongoDB-backed
 * ConfigStorageService instance.
 */
export function createDatabaseConfigDriver(
  configStorage: ConfigStorageService,
  configVariablesInstance: ConfigVariables,
): DatabaseConfigDriver {
  const cache = new ConfigCacheService();

  return new DatabaseConfigDriver(cache, configStorage, configVariablesInstance);
}
