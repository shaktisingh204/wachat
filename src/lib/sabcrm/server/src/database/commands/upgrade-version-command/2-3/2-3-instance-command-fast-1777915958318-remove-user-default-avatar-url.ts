import "server-only";

// PORT-NOTE: FastInstanceCommand — drops the defaultAvatarUrl column from the user table.
// In Mongo, this means removing the `defaultAvatarUrl` field from sabcrm_user documents.
// Version: 2.3.0  Timestamp: 1777915958318

export interface RemoveUserDefaultAvatarUrlMigration {
  version: "2.3.0";
  timestamp: 1777915958318;
  type: "fast";
  description: "Remove defaultAvatarUrl field from user";
}

/**
 * Mongo analogue:
 *
 * up:   ALTER TABLE "core"."user" DROP COLUMN "defaultAvatarUrl"
 *       -> db.sabcrm_user.updateMany({}, { $unset: { defaultAvatarUrl: "" } })
 *
 * down: ALTER TABLE "core"."user" ADD "defaultAvatarUrl" character varying
 *       -> Field is re-added implicitly; no DDL required in MongoDB.
 */
export async function up(): Promise<void> {
  // PORT-NOTE: Run the following against sabcrm_user to remove the field:
  //   db.sabcrm_user.updateMany({}, { $unset: { defaultAvatarUrl: "" } })
  // Remove `defaultAvatarUrl` from the User TS document type.
}

export async function down(): Promise<void> {
  // PORT-NOTE: Add `defaultAvatarUrl?: string` back to the User TS document type.
  //            No MongoDB DDL needed.
}
