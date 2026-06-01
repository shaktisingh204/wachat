// PORT-NOTE: Ported from twenty-server. @nestjs/graphql registerEnumType removed —
// the enum is still exported for use as a plain TypeScript enum / Zod discriminant.
export enum SupportDriver {
  NONE = 'NONE',
  FRONT = 'FRONT',
}
