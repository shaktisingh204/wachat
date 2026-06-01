import "server-only";

// PORT-NOTE: ClickHouseService is retained as a thin adapter type. In SabNode
// there is no global ClickHouse service — callers must supply a compatible
// client that exposes a `select<T>` method. Pass `null` for non-ClickHouse
// deployments; all methods guard and return empty results gracefully.

import { fillUsageTimeSeriesGaps } from "@/lib/sabcrm/server/src/engine/core-modules/usage/utils/fill-usage-time-series-gaps.util";
import { toDisplayCredits } from "@/lib/sabcrm/server/src/engine/core-modules/usage/utils/to-display-credits.util";
import { toDollars } from "@/lib/sabcrm/server/src/engine/core-modules/usage/utils/to-dollars.util";

export type UsageBreakdownItem = {
  key: string;
  label?: string;
  creditsUsed: number;
};

export type UsageTimeSeriesPoint = {
  date: string;
  creditsUsed: number;
};

type BreakdownRowMicro = {
  key: string;
  creditsUsedMicro: number;
};

type TimeSeriesRowMicro = {
  date: string;
  creditsUsedMicro: number;
};

type PeriodParams = {
  workspaceId: string;
  periodStart: Date;
  periodEnd: Date;
  operationTypes?: string[];
};

// Simple DateTime formatter matching ClickHouse expectations
function formatDateTimeForClickHouse(date: Date): string {
  return date.toISOString().replace("T", " ").substring(0, 19);
}

const ALLOWED_GROUP_BY_FIELDS = [
  "userWorkspaceId",
  "resourceId",
  "operationType",
  "resourceType",
  "resourceContext",
] as const;

type GroupByField = (typeof ALLOWED_GROUP_BY_FIELDS)[number];

const BREAKDOWN_QUERY_LIMIT = 50;

export type ClickHouseClient = {
  select<T>(query: string, params: Record<string, unknown>): Promise<T[]>;
  insert(table: string, rows: unknown[]): Promise<void>;
};

export async function getAdminAiUsageByWorkspace(
  client: ClickHouseClient,
  params: {
    periodStart: Date;
    periodEnd: Date;
    useDollarMode?: boolean;
  },
): Promise<UsageBreakdownItem[]> {
  const aiOperationTypes = ["AI_CHAT_TOKEN", "AI_WORKFLOW_TOKEN"];
  const convert = params.useDollarMode ? toDollars : toDisplayCredits;

  const query = `
    SELECT
      workspaceId AS key,
      sum(creditsUsedMicro) AS creditsUsedMicro
    FROM usageEvent
    WHERE timestamp >= {periodStart:String}
      AND timestamp < {periodEnd:String}
      AND operationType IN ({operationTypes:Array(String)})
    GROUP BY workspaceId
    ORDER BY creditsUsedMicro DESC
    LIMIT ${BREAKDOWN_QUERY_LIMIT}
  `;

  const rows = await client.select<BreakdownRowMicro>(query, {
    periodStart: formatDateTimeForClickHouse(params.periodStart),
    periodEnd: formatDateTimeForClickHouse(params.periodEnd),
    operationTypes: aiOperationTypes,
  });

  return rows.map((row) => ({
    key: row.key,
    creditsUsed: convert(row.creditsUsedMicro),
  }));
}

export async function getUsageByUser(
  client: ClickHouseClient,
  params: PeriodParams,
): Promise<UsageBreakdownItem[]> {
  return queryBreakdown(client, {
    ...params,
    groupByField: "userWorkspaceId",
    extraWhere: "AND userWorkspaceId != ''",
  });
}

export async function getUsageByModel(
  client: ClickHouseClient,
  params: PeriodParams,
): Promise<UsageBreakdownItem[]> {
  return queryBreakdown(client, {
    ...params,
    groupByField: "resourceContext",
    extraWhere: "AND resourceContext != ''",
  });
}

export async function getUsageByOperationType(
  client: ClickHouseClient,
  params: PeriodParams & { userWorkspaceId?: string },
): Promise<UsageBreakdownItem[]> {
  return queryBreakdown(client, {
    ...params,
    groupByField: "operationType",
    ...(params.userWorkspaceId
      ? {
          extraWhere: "AND userWorkspaceId = {userWorkspaceId:String}",
          extraParams: { userWorkspaceId: params.userWorkspaceId },
        }
      : {}),
  });
}

export async function getUsageByUserTimeSeries(
  client: ClickHouseClient,
  params: PeriodParams & { userWorkspaceId: string },
): Promise<UsageTimeSeriesPoint[]> {
  return queryTimeSeries(client, {
    ...params,
    extraWhere: "AND userWorkspaceId = {userWorkspaceId:String}",
    extraParams: { userWorkspaceId: params.userWorkspaceId },
  });
}

export async function getUsageTimeSeries(
  client: ClickHouseClient,
  params: PeriodParams,
): Promise<UsageTimeSeriesPoint[]> {
  return queryTimeSeries(client, params);
}

async function queryBreakdown(
  client: ClickHouseClient,
  {
    workspaceId,
    periodStart,
    periodEnd,
    groupByField,
    operationTypes,
    extraWhere = "",
    extraParams,
  }: PeriodParams & {
    groupByField: GroupByField;
    extraWhere?: string;
    extraParams?: Record<string, unknown>;
  },
): Promise<UsageBreakdownItem[]> {
  if (!ALLOWED_GROUP_BY_FIELDS.includes(groupByField)) {
    throw new Error(`Invalid groupByField: ${groupByField}`);
  }

  const opTypeFilter =
    operationTypes && operationTypes.length > 0
      ? "AND operationType IN ({operationTypes:Array(String)})"
      : "";

  const query = `
    SELECT
      ${groupByField} AS key,
      sum(creditsUsedMicro) AS creditsUsedMicro
    FROM usageEvent
    WHERE workspaceId = {workspaceId:String}
      AND timestamp >= {periodStart:String}
      AND timestamp < {periodEnd:String}
      ${opTypeFilter}
      ${extraWhere}
    GROUP BY ${groupByField}
    ORDER BY creditsUsedMicro DESC
    LIMIT ${BREAKDOWN_QUERY_LIMIT}
  `;

  const rows = await client.select<BreakdownRowMicro>(query, {
    workspaceId,
    periodStart: formatDateTimeForClickHouse(periodStart),
    periodEnd: formatDateTimeForClickHouse(periodEnd),
    ...(operationTypes && operationTypes.length > 0 ? { operationTypes } : {}),
    ...(extraParams ?? {}),
  });

  return rows.map((row) => ({
    key: row.key,
    creditsUsed: row.creditsUsedMicro,
  }));
}

async function queryTimeSeries(
  client: ClickHouseClient,
  {
    workspaceId,
    periodStart,
    periodEnd,
    operationTypes,
    extraWhere = "",
    extraParams,
  }: PeriodParams & {
    extraWhere?: string;
    extraParams?: Record<string, unknown>;
  },
): Promise<UsageTimeSeriesPoint[]> {
  const opTypeFilter =
    operationTypes && operationTypes.length > 0
      ? "AND operationType IN ({operationTypes:Array(String)})"
      : "";

  const query = `
    SELECT
      formatDateTime(timestamp, '%Y-%m-%d') AS date,
      sum(creditsUsedMicro) AS creditsUsedMicro
    FROM usageEvent
    WHERE workspaceId = {workspaceId:String}
      AND timestamp >= {periodStart:String}
      AND timestamp < {periodEnd:String}
      ${opTypeFilter}
      ${extraWhere}
    GROUP BY date
    ORDER BY date ASC
  `;

  const rows = await client.select<TimeSeriesRowMicro>(query, {
    workspaceId,
    periodStart: formatDateTimeForClickHouse(periodStart),
    periodEnd: formatDateTimeForClickHouse(periodEnd),
    ...(operationTypes && operationTypes.length > 0 ? { operationTypes } : {}),
    ...(extraParams ?? {}),
  });

  const points = rows.map((row) => ({
    date: row.date,
    creditsUsed: row.creditsUsedMicro,
  }));

  return fillUsageTimeSeriesGaps({ rows: points, periodStart, periodEnd });
}
