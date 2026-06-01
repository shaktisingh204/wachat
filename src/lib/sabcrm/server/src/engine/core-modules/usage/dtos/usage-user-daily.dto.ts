/* @license Enterprise */

// PORT-NOTE: NestJS @ObjectType / @Field GraphQL decorators removed.
// Ported to a plain TypeScript type.

import { type UsageTimeSeriesDTO } from "@/lib/sabcrm/server/src/engine/core-modules/usage/dtos/usage-time-series.dto";

export type UsageUserDailyDTO = {
  userWorkspaceId: string;
  dailyUsage: UsageTimeSeriesDTO[];
};
