import "server-only";

// PORT-NOTE: FastInstanceCommand — Postgres-only DDL.
// Original adds a tenantStatus enum column to emailingDomain and changes the
// uniqueness constraint from (domain, workspaceId) to just (domain).
// MongoDB has no DDL enum types or unique constraints declared via SQL.
// Document the intent so Mongo index management can replicate the invariant.

export interface FastInstanceCommand {
  up(): Promise<void>;
  down(): Promise<void>;
}

/**
 * v2.9.0 — fast instance command #1799000020000
 * Adds tenantStatus enum column and changes emailingDomain uniqueness to global domain-only.
 *
 * PORT-NOTE: The original command runs raw Postgres DDL:
 *   up:
 *     CREATE TYPE "core"."emailingDomain_tenantstatus_enum" AS ENUM('ACTIVE', 'PAUSED', 'PERMANENTLY_SUSPENDED')
 *     ALTER TABLE "core"."emailingDomain" ADD "tenantStatus" ... NOT NULL DEFAULT 'ACTIVE'
 *     DROP CONSTRAINT "IDX_EMAILING_DOMAIN_DOMAIN_WORKSPACE_ID_UNIQUE"
 *     ADD CONSTRAINT "IDX_EMAILING_DOMAIN_DOMAIN_UNIQUE" UNIQUE ("domain")
 *   down:
 *     DROP CONSTRAINT "IDX_EMAILING_DOMAIN_DOMAIN_UNIQUE"
 *     ADD CONSTRAINT "IDX_EMAILING_DOMAIN_DOMAIN_WORKSPACE_ID_UNIQUE" UNIQUE ("domain", "workspaceId")
 *     DROP COLUMN "tenantStatus"
 *     DROP TYPE "core"."emailingDomain_tenantstatus_enum"
 *
 * MongoDB analogues:
 *   up:
 *     1. Set tenantStatus: 'ACTIVE' on all existing sabcrm_emailingDomain documents that lack it.
 *     2. Drop any compound index on { domain, workspaceId } and create a unique index on { domain }.
 *   down:
 *     1. Drop the unique index on { domain }.
 *     2. Recreate a compound unique index on { domain, workspaceId }.
 *     3. Unset the tenantStatus field from all documents.
 */

export type EmailingDomainTenantStatus =
  | "ACTIVE"
  | "PAUSED"
  | "PERMANENTLY_SUSPENDED";

export class EmailingDomainTenantStatusAndGlobalUniquenessFastInstanceCommand
  implements FastInstanceCommand
{
  readonly version = "2.9.0";
  readonly timestamp = 1799000020000;

  public async up(): Promise<void> {
    // PORT-NOTE: Postgres DDL only. Apply the following Mongo operations manually:
    //
    //   db.sabcrm_emailingDomain.updateMany(
    //     { tenantStatus: { $exists: false } },
    //     { $set: { tenantStatus: 'ACTIVE' } }
    //   )
    //
    //   db.sabcrm_emailingDomain.dropIndex({ domain: 1, workspaceId: 1 })
    //   db.sabcrm_emailingDomain.createIndex({ domain: 1 }, { unique: true, name: 'IDX_EMAILING_DOMAIN_DOMAIN_UNIQUE' })
  }

  public async down(): Promise<void> {
    // PORT-NOTE: Postgres DDL only. Apply the following Mongo operations manually:
    //
    //   db.sabcrm_emailingDomain.dropIndex('IDX_EMAILING_DOMAIN_DOMAIN_UNIQUE')
    //   db.sabcrm_emailingDomain.createIndex(
    //     { domain: 1, workspaceId: 1 },
    //     { unique: true, name: 'IDX_EMAILING_DOMAIN_DOMAIN_WORKSPACE_ID_UNIQUE' }
    //   )
    //   db.sabcrm_emailingDomain.updateMany({}, { $unset: { tenantStatus: '' } })
  }
}
