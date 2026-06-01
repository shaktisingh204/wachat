// PORT-NOTE: Ported from twenty-server.
// NestJS class-transformer / class-validator decorators removed.
// getTransformers() and getValidators() return empty arrays — validation is
// performed via the toApp/toStorage functions rather than decorator pipelines.

import { ConfigVariableType } from '../enums/config-variable-type.enum';
import { ConfigVariableException, ConfigVariableExceptionCode } from '../twenty-config.exception';
import { type ConfigVariableOptions } from '../types/config-variable-options.type';
import { configTransformers } from './config-transformers.util';

export interface TypeTransformer<T> {
  toApp: (value: unknown, options?: ConfigVariableOptions) => T | undefined;
  toStorage: (value: T, options?: ConfigVariableOptions) => unknown;
  getValidators: (options?: ConfigVariableOptions) => PropertyDecorator[];
  getTransformers: () => PropertyDecorator[];
}

// PORT-NOTE: tryParseJsonArray is inlined here because the twenty-server
// src/utils/try-parse-json-array helper was not included in this batch.
function tryParseJsonArray(value: string): unknown[] | undefined {
  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) return parsed;
  } catch {
    // not valid JSON
  }

  return undefined;
}

export const typeTransformers: Record<ConfigVariableType, TypeTransformer<unknown>> = {
  [ConfigVariableType.BOOLEAN]: {
    toApp: (value: unknown): boolean | undefined => {
      if (value === null || value === undefined) return undefined;

      const result = configTransformers.boolean(value);

      if (result !== undefined && typeof result !== 'boolean') {
        throw new ConfigVariableException(
          `Expected boolean, got ${typeof result}`,
          ConfigVariableExceptionCode.VALIDATION_FAILED,
        );
      }

      return result;
    },

    toStorage: (value: unknown): boolean => {
      if (typeof value !== 'boolean') {
        throw new ConfigVariableException(
          `Expected boolean, got ${typeof value}`,
          ConfigVariableExceptionCode.VALIDATION_FAILED,
        );
      }

      return value;
    },

    getValidators: (): PropertyDecorator[] => [],
    getTransformers: (): PropertyDecorator[] => [],
  },

  [ConfigVariableType.NUMBER]: {
    toApp: (value: unknown): number | undefined => {
      if (value === null || value === undefined) return undefined;

      const result = configTransformers.number(value);

      if (result !== undefined && typeof result !== 'number') {
        throw new ConfigVariableException(
          `Expected number, got ${typeof result}`,
          ConfigVariableExceptionCode.VALIDATION_FAILED,
        );
      }

      return result;
    },

    toStorage: (value: unknown): number => {
      if (typeof value !== 'number') {
        throw new ConfigVariableException(
          `Expected number, got ${typeof value}`,
          ConfigVariableExceptionCode.VALIDATION_FAILED,
        );
      }

      return value;
    },

    getValidators: (): PropertyDecorator[] => [],
    getTransformers: (): PropertyDecorator[] => [],
  },

  [ConfigVariableType.STRING]: {
    toApp: (value: unknown): string | undefined => {
      if (value === null || value === undefined) return undefined;

      const result = configTransformers.string(value);

      if (result !== undefined && typeof result !== 'string') {
        throw new ConfigVariableException(
          `Expected string, got ${typeof result}`,
          ConfigVariableExceptionCode.VALIDATION_FAILED,
        );
      }

      return result;
    },

    toStorage: (value: unknown): string => {
      if (typeof value !== 'string') {
        throw new ConfigVariableException(
          `Expected string, got ${typeof value}`,
          ConfigVariableExceptionCode.VALIDATION_FAILED,
        );
      }

      return value;
    },

    getValidators: (): PropertyDecorator[] => [],
    getTransformers: (): PropertyDecorator[] => [],
  },

  [ConfigVariableType.ARRAY]: {
    toApp: (value: unknown, options?: ConfigVariableOptions): unknown[] | undefined => {
      if (value === null || value === undefined) return undefined;

      let arrayValue: unknown[];

      if (Array.isArray(value)) {
        arrayValue = value;
      } else if (typeof value === 'string') {
        const fromJson = tryParseJsonArray(value);

        if (fromJson !== undefined) {
          arrayValue = fromJson;
        } else {
          arrayValue = value.split(',').map((item) => item.trim());
        }
      } else {
        arrayValue = [value];
      }

      if (!options || !Array.isArray(options) || options.length === 0) {
        return arrayValue;
      }

      return arrayValue.filter((item) => (options as unknown[]).includes(item));
    },

    toStorage: (value: unknown, options?: ConfigVariableOptions): unknown[] => {
      if (!Array.isArray(value)) {
        throw new ConfigVariableException(
          `Expected array, got ${typeof value}`,
          ConfigVariableExceptionCode.VALIDATION_FAILED,
        );
      }

      if (!options || !Array.isArray(options) || options.length === 0) {
        return value;
      }

      return value.filter((item) => (options as unknown[]).includes(item));
    },

    getValidators: (): PropertyDecorator[] => [],
    getTransformers: (): PropertyDecorator[] => [],
  },

  [ConfigVariableType.ENUM]: {
    toApp: (value: unknown, options?: ConfigVariableOptions): string | undefined => {
      if (value === null || value === undefined) return undefined;

      if (!options || !Array.isArray(options) || options.length === 0) {
        return value as string;
      }

      return (options as unknown[]).includes(value) ? (value as string) : undefined;
    },

    toStorage: (value: unknown, options?: ConfigVariableOptions): string => {
      if (typeof value !== 'string') {
        throw new ConfigVariableException(
          `Expected string for enum, got ${typeof value}`,
          ConfigVariableExceptionCode.VALIDATION_FAILED,
        );
      }

      if (!options || !Array.isArray(options) || options.length === 0) {
        return value;
      }

      if (!(options as unknown[]).includes(value)) {
        throw new ConfigVariableException(
          `Value '${value}' is not a valid option for enum`,
          ConfigVariableExceptionCode.VALIDATION_FAILED,
        );
      }

      return value;
    },

    getValidators: (): PropertyDecorator[] => [],
    getTransformers: (): PropertyDecorator[] => [],
  },

  [ConfigVariableType.JSON]: {
    toApp: (value: unknown): Record<string, unknown> | undefined => {
      if (value === null || value === undefined) return undefined;

      if (typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }

      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);

          if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed;
          }

          throw new ConfigVariableException(
            'Expected JSON object, got non-object value',
            ConfigVariableExceptionCode.VALIDATION_FAILED,
          );
        } catch (error) {
          if (error instanceof ConfigVariableException) throw error;

          throw new ConfigVariableException(
            `Failed to parse JSON string: ${error instanceof Error ? error.message : String(error)}`,
            ConfigVariableExceptionCode.VALIDATION_FAILED,
          );
        }
      }

      throw new ConfigVariableException(
        `Expected JSON object or string, got ${typeof value}`,
        ConfigVariableExceptionCode.VALIDATION_FAILED,
      );
    },

    toStorage: (value: unknown): Record<string, unknown> => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new ConfigVariableException(
          `Expected JSON object, got ${Array.isArray(value) ? 'array' : typeof value}`,
          ConfigVariableExceptionCode.VALIDATION_FAILED,
        );
      }

      return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
    },

    getValidators: (): PropertyDecorator[] => [],
    getTransformers: (): PropertyDecorator[] => [],
  },
};
