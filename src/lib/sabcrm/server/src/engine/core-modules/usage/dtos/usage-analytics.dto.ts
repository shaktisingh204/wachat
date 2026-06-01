/* @license Enterprise */

// PORT-NOTE: NestJS @ObjectType / @Field GraphQL decorators removed.
// Ported to a plain TypeScript type.

import { type UsageBreakdownItemDTO } from "@/lib/sabcrm/server/src/engine/core-modules/usage/dtos/usage-breakdown-item.dto";
import { type UsageTimeSeriesDTO } from "@/lib/sabcrm/server/src/engine/core-modules/usage/dtos/usage-time-series.dto";
import { type UsageUserDailyDTO } from "@/lib/sabcrm/server/src/engine/core-modules/usage/dtos/usage-user-daily.dto";

export type UsageAnalyticsDTO = {
  usageByUser: UsageBreakdownItemDTO[];
  usageByOperationType: UsageBreakdownItemDTO[];
  usageByModel: UsageBreakdownItemDTO[];
  timeSeries: UsageTimeSeriesDTO[];
  periodStart: Date;
  periodEnd: Date;
  userDailyUsage?: UsageUserDailyDTO;
};
