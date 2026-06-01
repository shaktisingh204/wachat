// PORT-NOTE: Ported from twenty-server — pure TypeScript type, no framework deps.

export type ConfigVariableOptions =
  | readonly (string | number | boolean)[]
  | Record<string, string>;
