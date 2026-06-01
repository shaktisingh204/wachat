import "server-only";

// PORT-NOTE: Ported from twenty-server. NestJS @Injectable, @Cron, OnModuleInit removed.
// @Cron scheduling replaced with a plain setInterval pattern that callers can set up.
// ConfigCacheService and ConfigStorageService imported from their ported paths.
// ConfigVariables type is a placeholder — it will be filled once config-variables.ts is ported.

import { type DatabaseConfigDriverInterface } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/drivers/interfaces/database-config-driver.interface';
import { type ConfigVariables } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/config-variables';
import { ConfigCacheService } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/cache/config-cache.service';
import { ConfigStorageService } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/storage/config-storage.service';
import { isEnvOnlyConfigVar } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/utils/is-env-only-config-var.util';

export const CONFIG_VARIABLES_REFRESH_CRON_INTERVAL_MS = 15_000; // 15 seconds

export class DatabaseConfigDriver implements DatabaseConfigDriverInterface {
  private readonly allPossibleConfigKeys: Array<keyof ConfigVariables>;

  constructor(
    private readonly configCache: ConfigCacheService,
    private readonly configStorage: ConfigStorageService,
    configVariablesInstance: ConfigVariables,
  ) {
    const allKeys = Object.keys(configVariablesInstance) as Array<
      keyof ConfigVariables
    >;

    this.allPossibleConfigKeys = allKeys.filter(
      (key) => !isEnvOnlyConfigVar(key),
    );
  }

  async init(): Promise<void> {
    try {
      const loadedCount = await this.loadAllConfigVarsFromDb();

      console.log(
        `[DatabaseConfigDriver] Config variables loaded: ${loadedCount} values found in DB, ${this.allPossibleConfigKeys.length - loadedCount} falling to env vars/defaults`,
      );
    } catch (error) {
      console.error(
        '[DatabaseConfigDriver] Failed to load config variables from database, falling back to environment variables',
        error instanceof Error ? error.stack : error,
      );
      // Don't rethrow — let the caller continue with env vars / defaults
    }
  }

  get<T extends keyof ConfigVariables>(key: T): ConfigVariables[T] | undefined {
    return this.configCache.get(key);
  }

  async set<T extends keyof ConfigVariables>(
    key: T,
    value: ConfigVariables[T],
  ): Promise<void> {
    if (isEnvOnlyConfigVar(key)) {
      throw new Error(`Cannot set environment-only variable: ${key as string}`);
    }

    await this.configStorage.set(key, value);
    this.configCache.set(key, value);
  }

  async update<T extends keyof ConfigVariables>(
    key: T,
    value: ConfigVariables[T],
  ): Promise<void> {
    if (isEnvOnlyConfigVar(key)) {
      throw new Error(
        `Cannot update environment-only variable: ${key as string}`,
      );
    }

    await this.configStorage.set(key, value);
    this.configCache.set(key, value);
  }

  getCacheInfo(): {
    foundConfigValues: number;
    knownMissingKeys: number;
    cacheKeys: string[];
  } {
    return this.configCache.getCacheInfo();
  }

  private async loadAllConfigVarsFromDb(): Promise<number> {
    const configVars = await this.configStorage.loadAll();

    for (const [key, value] of configVars.entries()) {
      this.configCache.set(key, value);
    }

    for (const key of this.allPossibleConfigKeys) {
      if (!configVars.has(key)) {
        this.configCache.markKeyAsMissing(key);
      }
    }

    return configVars.size;
  }

  async delete(key: keyof ConfigVariables): Promise<void> {
    if (isEnvOnlyConfigVar(key)) {
      throw new Error(
        `Cannot delete environment-only variable: ${key as string}`,
      );
    }
    await this.configStorage.delete(key);
    this.configCache.markKeyAsMissing(key);
  }

  /**
   * Refreshes all database-backed config variables.
   * In SabNode, call this method from a Vercel Cron or setInterval instead of @Cron.
   */
  async refreshAllCache(): Promise<void> {
    try {
      const dbValues = await this.configStorage.loadAll();

      for (const [key, value] of dbValues.entries()) {
        if (!isEnvOnlyConfigVar(key)) {
          this.configCache.set(key, value);
        }
      }

      for (const key of this.allPossibleConfigKeys) {
        if (!dbValues.has(key)) {
          this.configCache.markKeyAsMissing(key);
        }
      }
    } catch (error) {
      console.error(
        '[DatabaseConfigDriver] Failed to refresh config variables from database',
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
