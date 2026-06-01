import "server-only";

// PORT-NOTE: FastInstanceCommand — pure Postgres DDL (ALTER TABLE core.application).
// In SabNode/Mongo the equivalent is adding an optional `logo` text field to
// documents in the sabcrm_application collection.
// Version: 2.2.0  Timestamp: 1777539664664

export interface AddLogoToApplicationMigration {
  version: "2.2.0";
  timestamp: 1777539664664;
  type: "fast";
  description: "Add optional logo (text) field to application";
}

/**
 * Mongo analogue:
 *
 * up:   ALTER TABLE "core"."application" ADD "logo" text
 *       -> Add `logo?: string` to the Application document type;
 *          no collection-level change needed in Mongo.
 *
 * down: ALTER TABLE "core"."application" DROP COLUMN "logo"
 *       -> Unset the field from all documents if rolling back.
 */
export async function up(): Promise<void> {
  // PORT-NOTE: Field is schema-less in MongoDB; update the Application TS type
  //            to include `logo?: string`.
}

export async function down(): Promise<void> {
  // PORT-NOTE: To roll back, $unset logo from all sabcrm_application documents.
}
