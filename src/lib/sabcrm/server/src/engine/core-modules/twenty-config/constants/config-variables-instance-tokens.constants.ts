// PORT-NOTE: NestJS injection tokens are not used in SabNode.
// Kept as a named export so any import referencing this constant still compiles.
export const CONFIG_VARIABLES_INSTANCE_TOKEN = Symbol(
  'CONFIG_VARIABLES_INSTANCE_TOKEN',
);
