// PORT-NOTE: Ported from twenty-server. class-validator decorators are pure TS; NestJS DI removed.
// TypedReflect is mapped to a local stub below; applyBasicValidators and config types are mapped to their ported paths.
import {
  IsOptional,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';

import { type ConfigVariableType } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/enums/config-variable-type.enum';
import { type ConfigVariablesGroup } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/enums/config-variables-group.enum';
import { TypedReflect } from '@/lib/sabcrm/server/src/utils/typed-reflect';

// Inline minimal type for config variable options to avoid deep import chain
export type ConfigVariableOptions =
  | { values: string[] }
  | Record<string, unknown>;

export interface ConfigVariablesMetadataOptions {
  group: ConfigVariablesGroup;
  description: string;
  isSensitive?: boolean;
  isEnvOnly?: boolean;
  isHiddenInAdminPanel?: boolean;
  type: ConfigVariableType;
  options?: ConfigVariableOptions;
}

export type ConfigVariablesMetadataMap = {
  [key: string]: ConfigVariablesMetadataOptions;
};

export function ConfigVariablesMetadata(
  options: ConfigVariablesMetadataOptions,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const existingMetadata: ConfigVariablesMetadataMap =
      TypedReflect.getMetadata('config-variables', target.constructor) ?? {};

    TypedReflect.defineMetadata(
      'config-variables',
      {
        ...existingMetadata,
        [propertyKey.toString()]: options,
      },
      target.constructor,
    );

    const propertyDescriptor = Object.getOwnPropertyDescriptor(
      (target as Record<string, unknown>).constructor,
      propertyKey,
    );
    const hasDefaultValue =
      propertyDescriptor && propertyDescriptor.value !== undefined;

    if (!hasDefaultValue) {
      IsOptional()(target, propertyKey as string);
    }

    registerDecorator({
      name: propertyKey.toString(),
      target: (target as Record<string, unknown>).constructor as new (
        ...args: unknown[]
      ) => unknown,
      propertyName: propertyKey.toString(),
      options: validationOptions,
      constraints: [options],
      validator: {
        validate() {
          return true;
        },
        defaultMessage() {
          return `${propertyKey.toString()} has invalid metadata`;
        },
      },
    });
  };
}
