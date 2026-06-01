/* @license Enterprise */

// PORT-NOTE: NestJS @ObjectType / @Field GraphQL decorators removed.
// Ported to a plain TypeScript type.

export type UsageTimeSeriesDTO = {
  /** ISO date string, e.g. "2024-01-15" */
  date: string;
  creditsUsed: number;
};
