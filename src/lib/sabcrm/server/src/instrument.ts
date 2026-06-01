// PORT-NOTE: Adapted from twenty-server/src/instrument.ts
// Sentry/OTLP/Prometheus instrumentation bootstrap — runs at process start.
// Postgres-specific integrations (Sentry.postgresIntegration) have no Mongo
// analogue; removed. All other Sentry/OTel behaviour is preserved.

import process from "process";

import { metrics as otelMetrics } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import {
  AggregationTemporality,
  ConsoleMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

// ---------------------------------------------------------------------------
// Types / constants mirrored from Twenty's internal modules
// ---------------------------------------------------------------------------

const NodeEnvironment = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
  TEST: "test",
} as const;

export const ExceptionHandlerDriver = {
  SENTRY: "SENTRY",
} as const;

export const MeterDriver = {
  Console: "console",
  OpenTelemetry: "opentelemetry",
  Prometheus: "prometheus",
} as const;

function parseArrayEnvVar<T extends string>(
  raw: string | undefined,
  allowed: T[],
  fallback: T[],
): T[] {
  if (!raw) return fallback;
  return raw
    .split(",")
    .map((s) => s.trim() as T)
    .filter((s) => allowed.includes(s));
}

// ---------------------------------------------------------------------------
// Sentry
// ---------------------------------------------------------------------------

const meterDrivers = parseArrayEnvVar(
  process.env.METER_DRIVER,
  Object.values(MeterDriver),
  [],
);

if (process.env.EXCEPTION_HANDLER_DRIVER === ExceptionHandlerDriver.SENTRY) {
  Sentry.init({
    environment: process.env.SENTRY_ENVIRONMENT,
    release: process.env.APP_VERSION,
    dsn: process.env.SENTRY_DSN,
    integrations: [
      Sentry.redisIntegration(),
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
      Sentry.graphqlIntegration(),
      // NOTE: Sentry.postgresIntegration() intentionally omitted — Mongo stack.
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.3,
    sendDefaultPii: true,
    debug: process.env.NODE_ENV === NodeEnvironment.DEVELOPMENT,
    beforeSendSpan: (span) => {
      const sabcrmContext = Sentry.getIsolationScope().getScopeData().contexts
        ?.sabcrm as
        | {
            workspace_id?: string;
            user_workspace_id?: string;
          }
        | undefined;

      if (!sabcrmContext?.workspace_id) {
        return span;
      }

      span.data = {
        ...span.data,
        "sabcrm.workspace.id": sabcrmContext.workspace_id,
        ...(sabcrmContext.user_workspace_id && {
          "sabcrm.user_workspace.id": sabcrmContext.user_workspace_id,
        }),
      };

      return span;
    },
  });
}

// ---------------------------------------------------------------------------
// OpenTelemetry Metrics
// ---------------------------------------------------------------------------

const prometheusExporter = meterDrivers.includes(MeterDriver.Prometheus)
  ? new PrometheusExporter({ port: 9464 })
  : null;

const meterProvider = new MeterProvider({
  readers: [
    ...(meterDrivers.includes(MeterDriver.Console)
      ? [
          new PeriodicExportingMetricReader({
            exporter: new ConsoleMetricExporter(),
            exportIntervalMillis: 10000,
          }),
        ]
      : []),
    ...(meterDrivers.includes(MeterDriver.OpenTelemetry)
      ? [
          new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({
              url: process.env.OTLP_COLLECTOR_METRICS_ENDPOINT_URL,
              temporalityPreference: AggregationTemporality.DELTA,
            }),
            exportIntervalMillis: 10000,
          }),
        ]
      : []),
    ...(prometheusExporter ? [prometheusExporter] : []),
  ],
});

otelMetrics.setGlobalMeterProvider(meterProvider);
