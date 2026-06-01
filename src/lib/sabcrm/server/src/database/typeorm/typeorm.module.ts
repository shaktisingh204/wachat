// PORT-NOTE: module-wiring
// Original: NestJS TypeORMModule wiring TypeORM + DatabaseGaugeService + MetricsModule.
// NestJS modules have no Next.js equivalent. This registry re-exports all ported pieces
// so consumers can import from a single entry point.
//
// Wired pieces:
//   - connectToDatabase (SabNode MongoDB connection, replaces TypeORM DataSource)
//   - isDatabaseUp / getDatabaseGauge (replaces DatabaseGaugeService)
//   - getRawDataSource (replaces rawDataSource)
//
// Usage: import { connectToDatabase, getDatabaseGauge } from "@/lib/sabcrm/server/src/database/typeorm/typeorm.module";

export { connectToDatabase } from "@/lib/mongodb";

export {
  isDatabaseUp,
  getDatabaseGauge,
} from "@/lib/sabcrm/server/src/database/typeorm/database-gauge.service";

export {
  getRawDataSource,
  rawDataSource,
} from "@/lib/sabcrm/server/src/database/typeorm/raw/raw.datasource";
