import { z } from 'zod';

// isValidVariable: checks if value matches {{ variable }} pattern
const isValidVariable = (variable: string): boolean =>
  /^{{[^{}]+}}$/.test(variable);

export const arrayOfStringsOrVariablesSchema = z
  .string()
  .transform((val) => {
    if (val === '') return [];
    if (isValidVariable(val)) {
      return [val];
    }
    return JSON.parse(val);
  })
  .refine(
    (parsed) =>
      Array.isArray(parsed) && parsed.every((item) => typeof item === 'string'),
    {
      message: 'Expected an array of strings',
    },
  );
