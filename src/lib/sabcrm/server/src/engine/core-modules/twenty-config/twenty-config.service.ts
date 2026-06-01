import "server-only";

// PORT-NOTE: service — NestJS DI removed; plain exported class.
// DatabaseConfigDriver / EnvironmentConfigDriver injected via constructor options.

import { type ConfigVariables } from './config-variables';
import { type ConfigVariablesMetadataOptions } from './decorators/config-variables-metadata.decorator';
import { ConfigSource } from './enums/config-source.enum';
import { ConfigVariablesMaskingStrategies } from './enums/config-variables-masking-strategies.enum';
import { ConfigVariableException, ConfigVariableExceptionCode } from './twenty-config.exception';
import { configVariableMaskSensitiveData } from './utils/config-variable-mask-sensitive-data.util';
import { isEnvOnlyConfigVar } from './utils/is-env-only-config-var.util';
import { TypedReflect } from '@/lib/sabcrm/server/src/utils/typed-reflect';

// Masking config — keys that require a specific masking strategy.
// Populated by the constant imported in the original source; kept as empty map
// here since CONFIG_VARIABLES_MASKING_CONFIG is ported separately.
const CONFIG_VARIABLES_MASKING_CONFIG: Partial<
  Record<string, { strategy: ConfigVariablesMaskingStrategies; chars?: number }>
> = {};

export interface DatabaseConfigDriver {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): Promise<void>;
  update<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  getCacheInfo(): {
    foundConfigValues: number;
    knownMissingKeys: number;
    cacheKeys: string[];
  };
}

export interface EnvironmentConfigDriver {
  get<T>(key: string): T;
}

const defaultEnvDriver: EnvironmentConfigDriver = {
  get<T>(key: string): T {
    return (process.env[key] ?? undefined) as T;
  },
};

export class TwentyConfigService {
  private readonly isDatabaseDriverActive: boolean;
  private readonly environmentDriver: EnvironmentConfigDriver;
  private readonly databaseDriver?: DatabaseConfigDriver;

  constructor(options?: {
    environmentDriver?: EnvironmentConfigDriver;
    databaseDriver?: DatabaseConfigDriver;
  }) {
    this.environmentDriver = options?.environmentDriver ?? defaultEnvDriver;
    this.databaseDriver = options?.databaseDriver;

    const isConfigVariablesInDbEnabled =
      this.environmentDriver.get<boolean | string>('IS_CONFIG_VARIABLES_IN_DB_ENABLED');

    this.isDatabaseDriverActive =
      !!isConfigVariablesInDbEnabled && !!this.databaseDriver;
  }

  get<T extends keyof ConfigVariables>(key: T): ConfigVariables[T] {
    if (isEnvOnlyConfigVar(key)) {
      return this.environmentDriver.get<ConfigVariables[T]>(key as string);
    }

    if (this.isDatabaseDriverActive && this.databaseDriver) {
      const cachedValueFromDb = this.databaseDriver.get<ConfigVariables[T]>(key as string);

      if (cachedValueFromDb !== undefined) {
        return cachedValueFromDb;
      }
    }

    return this.environmentDriver.get<ConfigVariables[T]>(key as string);
  }

  async set<T extends keyof ConfigVariables>(key: T, value: ConfigVariables[T]): Promise<void> {
    this.validateDatabaseDriverActive('set');
    this.validateNotEnvOnly(key, 'create');
    this.validateConfigVariableExists(key as string);
    await this.databaseDriver!.set(key as string, value);
  }

  async update<T extends keyof ConfigVariables>(key: T, value: ConfigVariables[T]): Promise<void> {
    this.validateDatabaseDriverActive('update');
    this.validateNotEnvOnly(key, 'update');
    this.validateConfigVariableExists(key as string);
    await this.databaseDriver!.update(key as string, value);
  }

  getMetadata(key: keyof ConfigVariables): ConfigVariablesMetadataOptions | undefined {
    return this.getConfigMetadata()[key as string];
  }

  getAll(): Record<
    string,
    { value: ConfigVariables[keyof ConfigVariables]; metadata: ConfigVariablesMetadataOptions; source: ConfigSource }
  > {
    const result: Record<
      string,
      { value: ConfigVariables[keyof ConfigVariables]; metadata: ConfigVariablesMetadataOptions; source: ConfigSource }
    > = {};

    const metadata = this.getConfigMetadata();

    for (const [key, envMetadata] of Object.entries(metadata)) {
      const typedKey = key as keyof ConfigVariables;
      let value = (this.get(typedKey) ?? '') as ConfigVariables[keyof ConfigVariables];
      const source = this.determineConfigSource(typedKey, value, envMetadata);

      value = this.maskSensitiveValue(typedKey, value, envMetadata) as ConfigVariables[keyof ConfigVariables];

      result[key] = { value, metadata: envMetadata, source };
    }

    return result;
  }

  getVariableWithMetadata(
    key: keyof ConfigVariables,
  ): { value: ConfigVariables[keyof ConfigVariables]; metadata: ConfigVariablesMetadataOptions; source: ConfigSource } | null {
    const metadata = this.getMetadata(key);

    if (!metadata) return null;

    let value = (this.get(key) ?? '') as ConfigVariables[keyof ConfigVariables];
    const source = this.determineConfigSource(key, value, metadata);

    value = this.maskSensitiveValue(key, value, metadata) as ConfigVariables[keyof ConfigVariables];

    return { value, metadata, source };
  }

  getCacheInfo(): {
    usingDatabaseDriver: boolean;
    cacheStats?: { foundConfigValues: number; knownMissingKeys: number; cacheKeys: string[] };
  } {
    const base = { usingDatabaseDriver: this.isDatabaseDriverActive };

    if (this.isDatabaseDriverActive && this.databaseDriver) {
      return { ...base, cacheStats: this.databaseDriver.getCacheInfo() };
    }

    return base;
  }

  async delete(key: keyof ConfigVariables): Promise<void> {
    this.validateDatabaseDriverActive('delete');
    this.validateConfigVariableExists(key as string);
    await this.databaseDriver!.delete(key as string);
  }

  isBillingEnabled(): boolean {
    return this.get('IS_BILLING_ENABLED' as keyof ConfigVariables) === true;
  }

  validateConfigVariableExists(key: string): boolean {
    const metadata = this.getConfigMetadata();

    if (!(key in metadata)) {
      throw new ConfigVariableException(
        `Config variable "${key}" does not exist in ConfigVariables`,
        ConfigVariableExceptionCode.VARIABLE_NOT_FOUND,
      );
    }

    return true;
  }

  private getConfigMetadata(): Record<string, ConfigVariablesMetadataOptions> {
    return TypedReflect.getMetadata('config-variables', ConfigVariables as unknown as object) ?? {};
  }

  private validateDatabaseDriverActive(operation: string): void {
    if (!this.isDatabaseDriverActive) {
      throw new ConfigVariableException(
        `Database configuration is disabled or unavailable, cannot ${operation} configuration`,
        ConfigVariableExceptionCode.DATABASE_CONFIG_DISABLED,
      );
    }
  }

  private validateNotEnvOnly(key: keyof ConfigVariables, operation: string): void {
    const envMetadata = this.getConfigMetadata()[key as string];

    if (envMetadata?.isEnvOnly) {
      throw new ConfigVariableException(
        `Cannot ${operation} environment-only variable: ${key as string}`,
        ConfigVariableExceptionCode.ENVIRONMENT_ONLY_VARIABLE,
      );
    }
  }

  private determineConfigSource(
    key: keyof ConfigVariables,
    value: unknown,
    metadata: ConfigVariablesMetadataOptions,
  ): ConfigSource {
    const defaultConfigVars = new ConfigVariables();

    if (!this.isDatabaseDriverActive || metadata.isEnvOnly) {
      return value === (defaultConfigVars as unknown as Record<string, unknown>)[key as string]
        ? ConfigSource.DEFAULT
        : ConfigSource.ENVIRONMENT;
    }

    if (this.databaseDriver) {
      const dbValue = this.databaseDriver.get(key as string);

      if (dbValue !== undefined) return ConfigSource.DATABASE;
    }

    return value === (defaultConfigVars as unknown as Record<string, unknown>)[key as string]
      ? ConfigSource.DEFAULT
      : ConfigSource.ENVIRONMENT;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private maskSensitiveValue(key: keyof ConfigVariables, value: any, metadata: ConfigVariablesMetadataOptions): any {
    const keyStr = key as string;

    if (keyStr in CONFIG_VARIABLES_MASKING_CONFIG) {
      if (typeof value !== 'string') return value;

      const varMaskingConfig = CONFIG_VARIABLES_MASKING_CONFIG[keyStr]!;
      const options =
        varMaskingConfig.strategy === ConfigVariablesMaskingStrategies.LAST_N_CHARS
          ? { chars: varMaskingConfig.chars }
          : undefined;

      return configVariableMaskSensitiveData(value, varMaskingConfig.strategy, {
        ...options,
        variableName: keyStr,
      });
    }

    if (metadata?.isSensitive) {
      if (!value && value !== false && value !== 0) return value;

      if (typeof value === 'string') {
        return configVariableMaskSensitiveData(
          value,
          ConfigVariablesMaskingStrategies.LAST_N_CHARS,
          { chars: 4, variableName: keyStr },
        );
      }

      return '********';
    }

    return value;
  }
}
