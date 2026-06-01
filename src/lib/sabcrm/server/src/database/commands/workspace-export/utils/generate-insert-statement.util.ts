// PORT-NOTE: Ported from twenty-server database/commands/workspace-export/utils/generate-insert-statement.util.ts
// Pure utility — no NestJS or Postgres dependencies.

export const generateInsertStatement = (
  insertPrefix: string,
  formattedValues: string[],
): string => `${insertPrefix}(${formattedValues.join(', ')});\n`;
