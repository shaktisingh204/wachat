import "server-only";

import { ConfigVariables, ConfigVariableType, ConfigVariableException, ConfigVariableExceptionCode } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/config-variables';

// PORT-NOTE: NestJS @Injectable / @Inject removed. TypedReflect and
// typeTransformers are internal Twenty utilities that rely on Reflect metadata
// from class-validator decorators. In SabNode we provide a best-effort
// implementation using the same inference logic.

type ConfigKey = keyof ConfigVariables;
type ConfigValue<T extends ConfigKey> = ConfigVariables[T];

type TypeTransformer = {
  toApp: (value: unknown, options?: unknown[]) => unknown;
  toStorage: (value: unknown, options?: unknown[]) => unknown;
};

const typeTransformers: Partial<Record<ConfigVariableType, TypeTransformer>> = {
  [ConfigVariableType.BOOLEAN]: {
    toApp: (value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') return value === 'true';

      return Boolean(value);
    },
    toStorage: (value) => String(value),
  },
  [ConfigVariableType.NUMBER]: {
    toApp: (value) => {
      const n = Number(value);

      return isNaN(n) ? undefined : n;
    },
    toStorage: (value) => String(value),
  },
  [ConfigVariableType.STRING]: {
    toApp: (value) => String(value),
    toStorage: (value) => String(value),
  },
  [ConfigVariableType.ARRAY]: {
    toApp: (value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') return value.split(',').map((v) => v.trim());

      return [];
    },
    toStorage: (value) => {
      if (Array.isArray(value)) return value.join(',');

      return String(value);
    },
  },
  [ConfigVariableType.JSON]: {
    toApp: (value) => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      }

      return value;
    },
    toStorage: (value) => JSON.stringify(value),
  },
  [ConfigVariableType.ENUM]: {
    toApp: (value, options) => {
      const str = String(value);

      if (options && !options.includes(str)) {
        return undefined;
      }

      return str;
    },
    toStorage: (value) => String(value),
  },
};

export class ConfigValueConverterService {
  private readonly configVariables: ConfigVariables;

  constructor(configVariables: ConfigVariables) {
    this.configVariables = configVariables;
  }

  convertDbValueToAppValue<T extends ConfigKey>(
    dbValue: unknown,
    key: T,
  ): ConfigValue<T> | undefined {
    if (dbValue === null || dbValue === undefined) {
      return undefined;
    }

    const configType = this.inferTypeFromValue(key);

    try {
      const transformer = typeTransformers[configType];

      if (!transformer) {
        return dbValue as ConfigValue<T>;
      }

      return transformer.toApp(dbValue) as ConfigValue<T>;
    } catch (error) {
      throw new ConfigVariableException(
        `Failed to convert ${String(key)} to app value: ${(error as Error).message}`,
        ConfigVariableExceptionCode.VALIDATION_FAILED,
      );
    }
  }

  convertAppValueToDbValue<T extends ConfigKey>(
    appValue: ConfigValue<T> | null | undefined,
    key: T,
  ): unknown {
    if (appValue === null || appValue === undefined) {
      return null;
    }

    const configType = this.inferTypeFromValue(key);

    try {
      const transformer = typeTransformers[configType];

      if (!transformer) {
        if (typeof appValue === 'object') {
          try {
            return JSON.parse(JSON.stringify(appValue));
          } catch (error) {
            throw new ConfigVariableException(
              `Failed to serialize object value: ${error instanceof Error ? error.message : String(error)}`,
              ConfigVariableExceptionCode.VALIDATION_FAILED,
            );
          }
        }

        return appValue;
      }

      return transformer.toStorage(appValue as unknown);
    } catch (error) {
      if (error instanceof ConfigVariableException) {
        throw error;
      }

      throw new ConfigVariableException(
        `Failed to convert ${String(key)} to DB value: ${(error as Error).message}`,
        ConfigVariableExceptionCode.VALIDATION_FAILED,
      );
    }
  }

  private inferTypeFromValue<T extends ConfigKey>(key: T): ConfigVariableType {
    const defaultValue = this.configVariables[key];

    if (typeof defaultValue === 'boolean') return ConfigVariableType.BOOLEAN;
    if (typeof defaultValue === 'number') return ConfigVariableType.NUMBER;
    if (Array.isArray(defaultValue)) return ConfigVariableType.ARRAY;
    if (
      typeof defaultValue === 'object' &&
      defaultValue !== null &&
      !Array.isArray(defaultValue)
    ) {
      return ConfigVariableType.JSON;
    }

    return ConfigVariableType.STRING;
  }
}
