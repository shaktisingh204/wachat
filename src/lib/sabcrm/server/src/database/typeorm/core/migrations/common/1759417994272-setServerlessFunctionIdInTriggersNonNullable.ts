// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: Makes serverlessFunctionId NOT NULL on cronTrigger, databaseEventTrigger, and route tables.
// In Mongo this is enforced at the application/validation layer; no DDL index is created here.

/**
 * Migration 1759417994272 – SetServerlessFunctionIdInTriggersNonNullable
 *
 * Postgres intent:
 *   UP:   cronTrigger.serverlessFunctionId SET NOT NULL (drop + re-add FK);
 *         databaseEventTrigger.serverlessFunctionId SET NOT NULL (drop + re-add FK);
 *         route.serverlessFunctionId SET NOT NULL (drop + re-add FK).
 *   DOWN: make all three nullable again.
 *
 * Mongo equivalent:
 *   - In sabcrm_cronTrigger, sabcrm_databaseEventTrigger, and sabcrm_route (now sabcrm_routeTrigger),
 *     ensure `serverlessFunctionId` is always present. This is enforced by Zod validation in server
 *     actions rather than a DB-level constraint.
 *   - No index changes required.
 *
 * One-off cleanup (verify & remove documents missing serverlessFunctionId):
 *   db.sabcrm_cronTrigger.find({ serverlessFunctionId: { $exists: false } })
 *   db.sabcrm_databaseEventTrigger.find({ serverlessFunctionId: { $exists: false } })
 *   db.sabcrm_routeTrigger.find({ serverlessFunctionId: { $exists: false } })
 */

export const migrationNote = {
  id: "1759417994272",
  name: "SetServerlessFunctionIdInTriggersNonNullable",
  mongoEquivalent:
    "Application-layer Zod validation enforces serverlessFunctionId presence; no DDL required",
} as const;
