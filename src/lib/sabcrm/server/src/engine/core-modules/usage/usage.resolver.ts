import "server-only";

// PORT-NOTE: NestJS GraphQL resolver replaced with a plain async server
// function. Input/output shapes preserved. Mongo is used in place of TypeORM
// for user-workspace lookups.

import { connectToDatabase } from "@/lib/mongodb";
import {
  getUsageByUser,
  getUsageByOperationType,
  getUsageByModel,
  getUsageTimeSeries,
  getUsageByUserTimeSeries,
  type UsageBreakdownItem,
  type UsageTimeSeriesPoint,
  type ClickHouseClient,
} from "@/lib/sabcrm/server/src/engine/core-modules/usage/services/usage-analytics.service";
import { toDisplayCredits } from "@/lib/sabcrm/server/src/engine/core-modules/usage/utils/to-display-credits.util";

export type UsageAnalyticsInput = {
  periodStart?: Date;
  periodEnd?: Date;
  operationTypes?: string[];
  userWorkspaceId?: string;
};

export type UsageBreakdownItemDTO = {
  key: string;
  label?: string;
  creditsUsed: number;
};

export type UsageTimeSeriesPointDTO = {
  date: string;
  creditsUsed: number;
};

export type UserDailyUsage = {
  userWorkspaceId: string;
  dailyUsage: UsageTimeSeriesPointDTO[];
};

export type UsageAnalyticsDTO = {
  usageByUser: UsageBreakdownItemDTO[];
  usageByOperationType: UsageBreakdownItemDTO[];
  usageByModel: UsageBreakdownItemDTO[];
  timeSeries: UsageTimeSeriesPointDTO[];
  periodStart: Date;
  periodEnd: Date;
  userDailyUsage?: UserDailyUsage;
};

function toDTO(item: UsageBreakdownItem): UsageBreakdownItemDTO {
  return { ...item, creditsUsed: toDisplayCredits(item.creditsUsed) };
}

function toTimeDTO(point: UsageTimeSeriesPoint): UsageTimeSeriesPointDTO {
  return { ...point, creditsUsed: toDisplayCredits(point.creditsUsed) };
}

async function resolveUserNames(
  userWorkspaceIds: string[],
  workspaceId: string,
): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  if (userWorkspaceIds.length === 0) return nameMap;

  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_user_workspace");

  const userWorkspaces = await collection
    .find(
      { _id: { $in: userWorkspaceIds }, workspaceId },
      { projection: { _id: 1, user: 1 } },
    )
    .toArray();

  for (const uw of userWorkspaces) {
    const user = uw.user as { firstName?: string; lastName?: string; email?: string } | undefined;
    if (!user) continue;
    const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
    nameMap.set(String(uw._id), fullName || (user.email ?? ""));
  }

  return nameMap;
}

export async function getUsageAnalytics(
  workspaceId: string,
  clickhouseClient: ClickHouseClient | null,
  input?: UsageAnalyticsInput,
): Promise<UsageAnalyticsDTO> {
  if (!clickhouseClient) {
    // ClickHouse not available — return empty analytics
    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);
    return {
      usageByUser: [],
      usageByOperationType: [],
      usageByModel: [],
      timeSeries: [],
      periodStart: input?.periodStart ?? monthAgo,
      periodEnd: input?.periodEnd ?? now,
    };
  }

  const defaultPeriodEnd = new Date();
  const defaultPeriodStart = new Date();
  defaultPeriodStart.setDate(defaultPeriodStart.getDate() - 30);

  const periodStart = input?.periodStart ?? defaultPeriodStart;
  const periodEnd = input?.periodEnd ?? defaultPeriodEnd;

  const periodParams = {
    workspaceId,
    periodStart,
    periodEnd,
    operationTypes: input?.operationTypes ?? undefined,
  };

  const [usageByUser, usageByOperationType, usageByModel, timeSeries] =
    await Promise.all([
      getUsageByUser(clickhouseClient, periodParams),
      getUsageByOperationType(clickhouseClient, {
        ...periodParams,
        userWorkspaceId: input?.userWorkspaceId ?? undefined,
      }),
      getUsageByModel(clickhouseClient, periodParams),
      getUsageTimeSeries(clickhouseClient, periodParams),
    ]);

  // Resolve user display names
  const nameMap = await resolveUserNames(
    usageByUser.map((item) => item.key),
    workspaceId,
  );
  const resolvedUsageByUser = usageByUser.map((item) => ({
    ...item,
    label: nameMap.get(item.key),
  }));

  const result: UsageAnalyticsDTO = {
    usageByUser: resolvedUsageByUser.map(toDTO),
    usageByOperationType: usageByOperationType.map(toDTO),
    usageByModel: usageByModel.map(toDTO),
    timeSeries: timeSeries.map(toTimeDTO),
    periodStart,
    periodEnd,
  };

  if (input?.userWorkspaceId) {
    const { db } = await connectToDatabase();
    const userWorkspace = await db.collection("sabcrm_user_workspace").findOne(
      { _id: input.userWorkspaceId, workspaceId },
      { projection: { _id: 1 } },
    );

    if (userWorkspace) {
      const dailyUsage = await getUsageByUserTimeSeries(clickhouseClient, {
        ...periodParams,
        userWorkspaceId: input.userWorkspaceId,
      });

      result.userDailyUsage = {
        userWorkspaceId: input.userWorkspaceId,
        dailyUsage: dailyUsage.map(toTimeDTO),
      };
    }
  }

  return result;
}
