// PORT-NOTE: Ported from twenty-server/src/utils/typed-reflect.ts.
// NestJS-specific metadata keys (gate, workspace, feature-flag) are preserved as stubs;
// only the 'config-variables' key is actively used in SabNode's ported code.
// Requires `reflect-metadata` — ensure it is imported at the app entry point.

import 'reflect-metadata';

import { type ConfigVariablesMetadataMap } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/decorators/config-variables-metadata.decorator';

export interface ReflectMetadataTypeMap {
  ['workspace:is-nullable-metadata-args']: true;
  ['workspace:gate-metadata-args']: unknown;
  ['workspace:is-system-metadata-args']: true;
  ['workspace:is-field-ui-readonly-metadata-args']: true;
  ['workspace:is-object-ui-readonly-metadata-args']: true;
  ['workspace:is-audit-logged-metadata-args']: false;
  ['workspace:is-primary-field-metadata-args']: true;
  ['workspace:is-deprecated-field-metadata-args']: true;
  ['workspace:is-unique-metadata-args']: true;
  ['workspace:duplicate-criteria-metadata-args']: unknown[];
  ['config-variables']: ConfigVariablesMetadataMap;
  ['workspace:is-searchable-metadata-args']: boolean;
  ['feature-flag-metadata-args']: string;
}

export class TypedReflect {
  static defineMetadata<T extends keyof ReflectMetadataTypeMap>(
    metadataKey: T,
    metadataValue: ReflectMetadataTypeMap[T],
    target: object,
  ): void;

  static defineMetadata<T extends keyof ReflectMetadataTypeMap>(
    metadataKey: T,
    metadataValue: ReflectMetadataTypeMap[T],
    target: object,
    propertyKey: string,
  ): void;

  static defineMetadata<T extends keyof ReflectMetadataTypeMap>(
    metadataKey: T,
    metadataValue: ReflectMetadataTypeMap[T],
    target: object,
    propertyKeyOrUndefined?: string,
  ) {
    if (propertyKeyOrUndefined === undefined) {
      Reflect.defineMetadata(metadataKey, metadataValue, target);
    } else {
      Reflect.defineMetadata(
        metadataKey,
        metadataValue,
        target,
        propertyKeyOrUndefined,
      );
    }
  }

  static getMetadata<T extends keyof ReflectMetadataTypeMap>(
    metadataKey: T,
    target: object,
  ): ReflectMetadataTypeMap[T] | undefined;

  static getMetadata<T extends keyof ReflectMetadataTypeMap>(
    metadataKey: T,
    target: object,
    propertyKey: string,
  ): ReflectMetadataTypeMap[T] | undefined;

  static getMetadata<T extends keyof ReflectMetadataTypeMap>(
    metadataKey: T,
    target: object,
    propertyKeyOrUndefined?: string,
  ) {
    if (propertyKeyOrUndefined === undefined) {
      return Reflect.getMetadata(metadataKey, target) as
        | ReflectMetadataTypeMap[T]
        | undefined;
    } else {
      return Reflect.getMetadata(metadataKey, target, propertyKeyOrUndefined) as
        | ReflectMetadataTypeMap[T]
        | undefined;
    }
  }
}
