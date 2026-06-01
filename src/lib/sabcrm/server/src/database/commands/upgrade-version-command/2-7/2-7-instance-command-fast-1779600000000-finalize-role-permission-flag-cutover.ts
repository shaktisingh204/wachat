import "server-only";

// PORT-NOTE: FastInstanceCommand — Postgres-only DDL (ALTER TABLE core.rolePermissionFlag).
// In SabNode/Mongo there is no rolePermissionFlag SQL table; this command captures the
// original intent so the mapping stays complete. Run the equivalent Mongo collection
// maintenance manually if needed.

export interface FastInstanceCommand {
  up(): Promise<void>;
  down(): Promise<void>;
}

/**
 * v2.7.0 — fast instance command #1779600000000
 * Finalizes the rolePermissionFlag flag column cutover:
 *   up:   drops the legacy "flag" varchar column + its unique constraint,
 *         sets permissionFlagId NOT NULL.
 *   down: restores "flag" from permissionFlag.key, re-adds the constraint,
 *         drops NOT NULL from permissionFlagId.
 *
 * PORT-NOTE: The original command runs raw Postgres DDL against the "core" schema.
 * There is no direct Mongo equivalent — document this intent for operators who
 * may need to perform an equivalent data-cleanup on the sabcrm_rolePermissionFlag
 * collection (ensure every document has a permissionFlagId and no "flag" field).
 */
export class FinalizeRolePermissionFlagCutoverFastInstanceCommand
  implements FastInstanceCommand
{
  readonly version = "2.7.0";
  readonly timestamp = 1779600000000;

  public async up(): Promise<void> {
    // PORT-NOTE: Postgres DDL — no Mongo analogue.
    // Equivalent intent for Mongo:
    //   1. Assert all sabcrm_rolePermissionFlag documents have a non-null permissionFlagId.
    //   2. Unset the "flag" field from all documents.
    //   3. Drop any index named IDX_ROLE_PERMISSION_FLAG_FLAG_ROLE_ID_UNIQUE.
    throw new Error(
      "FinalizeRolePermissionFlagCutoverFastInstanceCommand.up() is Postgres-only DDL. " +
        "Apply equivalent Mongo maintenance manually on the sabcrm_rolePermissionFlag collection.",
    );
  }

  public async down(): Promise<void> {
    // PORT-NOTE: Postgres DDL — no Mongo analogue.
    throw new Error(
      "FinalizeRolePermissionFlagCutoverFastInstanceCommand.down() is Postgres-only DDL. " +
        "Apply equivalent Mongo rollback manually on the sabcrm_rolePermissionFlag collection.",
    );
  }
}
