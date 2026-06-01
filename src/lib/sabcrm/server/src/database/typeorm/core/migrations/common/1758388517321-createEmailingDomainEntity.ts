// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: creates core."emailingDomain" table with enums (driver, status), unique constraint on (domain, workspaceId), FK to workspace.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

/**
 * Migration 1758388517321 – CreateEmailingDomainEntity
 *
 * Postgres intent:
 *   UP:   CREATE TYPE emailingDomain_driver_enum AS ENUM('AWS_SES');
 *         CREATE TYPE emailingDomain_status_enum AS ENUM('PENDING','VERIFIED','FAILED','TEMPORARY_FAILURE');
 *         CREATE TABLE core.emailingDomain (id uuid PK, createdAt, updatedAt, domain varchar NOT NULL,
 *           driver emailingDomain_driver_enum NOT NULL, status emailingDomain_status_enum NOT NULL DEFAULT 'PENDING',
 *           verificationRecords jsonb, verifiedAt timestamptz, workspaceId uuid NOT NULL,
 *           UNIQUE(domain, workspaceId), FK workspaceId -> workspace(id) ON DELETE CASCADE);
 *   DOWN: DROP TABLE; DROP TYPEs.
 *
 * Mongo equivalent:
 *   - Collection: sabcrm_emailingDomain
 *   - Unique compound index on { domain, workspaceId }
 *   - Allowed driver values: 'AWS_SES'
 *   - Allowed status values: 'PENDING' | 'VERIFIED' | 'FAILED' | 'TEMPORARY_FAILURE'  (default 'PENDING')
 */

export type EmailingDomainDriver = "AWS_SES";
export type EmailingDomainStatus =
  | "PENDING"
  | "VERIFIED"
  | "FAILED"
  | "TEMPORARY_FAILURE";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_emailingDomain");

  await collection.createIndex(
    { domain: 1, workspaceId: 1 },
    {
      unique: true,
      name: "IDX_emailingDomain_domain_workspaceId_unique",
    },
  );

  // Index for cascade-style lookups by workspaceId
  await collection.createIndex(
    { workspaceId: 1 },
    { name: "IDX_emailingDomain_workspaceId" },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection("sabcrm_emailingDomain").drop();
}

export const migrationNote = {
  id: "1758388517321",
  name: "CreateEmailingDomainEntity",
  mongoEquivalent:
    "sabcrm_emailingDomain collection + unique index on { domain, workspaceId }",
} as const;
