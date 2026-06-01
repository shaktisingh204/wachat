// PORT-NOTE: TypeORM is not used in SabNode (Mongo-native). The decorator is
// preserved for ConfigVariables completeness; callers that actually use TypeORM
// log levels should supply the raw array directly.
import { Transform } from 'class-transformer';

const VALID_TYPEORM_LOG_LEVELS = [
  'query',
  'schema',
  'error',
  'warn',
  'info',
  'log',
  'migration',
];

export const CastToTypeORMLogLevelArray = () =>
  Transform(({ value }: { value: string }) => toTypeORMLogLevelArray(value));

const toTypeORMLogLevelArray = (value: unknown): string[] | undefined => {
  if (typeof value === 'string' && value.length > 0) {
    const rawLogLevels = value.split(',').map((level) => level.trim());
    const isInvalid = rawLogLevels.some(
      (level) => !VALID_TYPEORM_LOG_LEVELS.includes(level),
    );

    if (!isInvalid) {
      return rawLogLevels;
    }
  }

  return undefined;
};

export { toTypeORMLogLevelArray as castToTypeORMLogLevelArray };
