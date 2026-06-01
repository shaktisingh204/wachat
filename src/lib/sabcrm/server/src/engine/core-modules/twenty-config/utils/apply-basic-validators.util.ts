// PORT-NOTE: Ported from twenty-server — NestJS class-transformer/class-validator
// decorators replaced with plain transformer/validator function types.
// getTransformers/getValidators return no-op arrays since decorator-based
// validation is not used in the Next.js + Mongo stack.

import { ConfigVariableType } from '../enums/config-variable-type.enum';
import { ConfigVariableException, ConfigVariableExceptionCode } from '../twenty-config.exception';
import { type ConfigVariableOptions } from '../types/config-variable-options.type';
import { typeTransformers } from './type-transformers.registry';

export function applyBasicValidators(
  type: ConfigVariableType,
  _target: object,
  _propertyKey: string,
  options?: ConfigVariableOptions,
): void {
  const transformer = typeTransformers[type];

  if (!transformer) {
    throw new ConfigVariableException(
      `Unsupported config variable type: ${type}`,
      ConfigVariableExceptionCode.UNSUPPORTED_CONFIG_TYPE,
    );
  }

  // In the Next.js/Mongo stack decorators are not used; calling getTransformers
  // and getValidators here for parity but the returned arrays are intentionally unused.
  transformer.getTransformers();
  transformer.getValidators(options);
}
