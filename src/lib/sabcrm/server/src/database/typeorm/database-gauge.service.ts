import "server-only";

// PORT-NOTE: service
// Original: NestJS DatabaseGaugeService using TypeORM DataSource + MetricsService.
// Ported as a plain exported function that checks MongoDB connectivity and returns
// a gauge value (1 = up, 0 = down). The NestJS @Injectable / OnModuleInit lifecycle
// is replaced by a direct function callers can invoke (e.g., from a health-check API route).

import { connectToDatabase } from "@/lib/mongodb";

/**
 * Checks whether the SabCRM MongoDB database is reachable.
 * Returns 1 if the database responds, 0 if it does not.
 */
export async function isDatabaseUp(): Promise<number> {
  try {
    const db = await connectToDatabase();
    // Run a lightweight ping command equivalent
    await db.command({ ping: 1 });
    return 1;
  } catch (error) {
    console.error("[DatabaseGaugeService] Database health check failed", error);
    return 0;
  }
}

/**
 * Returns a gauge snapshot for the CRM database.
 * Shape matches the original MetricsService observable gauge callback output.
 */
export async function getDatabaseGauge(): Promise<{ metricName: string; value: number }> {
  return {
    metricName: "sabcrm_database_up",
    value: await isDatabaseUp(),
  };
}
