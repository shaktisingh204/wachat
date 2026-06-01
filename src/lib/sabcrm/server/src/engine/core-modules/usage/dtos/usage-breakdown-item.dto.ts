/* @license Enterprise */

// PORT-NOTE: NestJS @ObjectType / @Field GraphQL decorators removed.
// Ported to a plain TypeScript type.

export type UsageBreakdownItemDTO = {
  key: string;
  label?: string;
  creditsUsed: number;
};
