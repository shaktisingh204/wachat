import { z } from 'zod';

// isValidVariable: checks if value matches {{ variable }} pattern
const isValidVariable = (variable: string): boolean =>
  /^{{[^{}]+}}$/.test(variable);

// isValidUuid: validates standard UUID v1-v5 format
const isValidUuid = (value: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export const arrayOfUuidOrVariableSchema = z
  .preprocess(
    (value) => {
      try {
        if (typeof value === 'string') {
          if (isValidVariable(value)) {
            return [value];
          }
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            return [value];
          }
        }
        return Array.isArray(value) ? value : [value];
      } catch {
        return [];
      }
    },
    z.array(
      z.string().refine((val) => {
        return isValidUuid(val) || isValidVariable(val);
      }, 'Must be a valid UUID or a variable with {{ }} syntax'),
    ),
  )
  .catch([]);
