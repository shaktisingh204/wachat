import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: This was a TypeORM/Postgres slow instance command that:
//   1. (runDataMigration)
//      a. Validated that all `flag` values in rolePermissionFlag are known
//         PermissionFlagType enum values.
//      b. Inserted permissionFlag rows for each standard definition × workspace
//         (using the standardApplication universalIdentifier) with ON CONFLICT
//         DO NOTHING.
//      c. Updated rolePermissionFlag.permissionFlagId by joining on
//         (workspaceId, key=flag).
//   2. (up/down) No-ops.
//
// In MongoDB:
//   - The INSERT × workspace seed + UPDATE join are ported using the
//     sabcrm_permissionflag and sabcrm_rolepermissionflag collections.
//   - Standard permission flag definitions and the
//     TWENTY_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER constant must be
//     supplied by the caller (to avoid re-importing NestJS DI modules).

export const VERSION = '2.6.0';
export const TIMESTAMP = 1778235340023;

export type StandardPermissionFlagDefinition = {
  universalIdentifier: string;
  key: string;
  label: string;
  description: string | null;
  icon: string | null;
  permissionType: string;
};

export async function runDataMigration(
  standardPermissionFlagDefinitions: StandardPermissionFlagDefinition[],
  standardApplicationUniversalIdentifier: string,
  knownPermissionFlagTypes: string[],
): Promise<void> {
  const { db } = await connectToDatabase();

  const rolePermissionFlagCol = db.collection<{
    _id: string;
    flag: string;
    workspaceId: string;
    permissionFlagId?: string | null;
  }>('sabcrm_rolepermissionflag');

  const permissionFlagCol = db.collection<{
    _id?: string;
    workspaceId: string;
    applicationId: string;
    universalIdentifier: string;
    key: string;
    label: string;
    description: string | null;
    icon: string | null;
    permissionType: string;
    createdAt: Date;
    updatedAt: Date;
  }>('sabcrm_permissionflag');

  const applicationCol = db.collection<{
    _id: string;
    workspaceId: string;
    universalIdentifier: string;
    deletedAt?: Date | null;
  }>('sabcrm_application');

  // 1. Validate all flag values
  const unknownFlagDocs = await rolePermissionFlagCol
    .find({ flag: { $nin: knownPermissionFlagTypes } })
    .toArray();

  if (unknownFlagDocs.length > 0) {
    const unknownFlags = [...new Set(unknownFlagDocs.map((d) => d.flag))].join(', ');
    throw new Error(
      `Cannot migrate: rolePermissionFlag rows reference unknown flag value(s): ${unknownFlags}`,
    );
  }

  // 2. Seed permissionFlag for each standard definition × workspace
  const workspaceCol = db.collection<{ _id: string }>('sabcrm_workspace');
  const workspaces = await workspaceCol.find({}).toArray();

  for (const definition of standardPermissionFlagDefinitions) {
    for (const workspace of workspaces) {
      // Find the standard application for this workspace
      const standardApplication = await applicationCol.findOne({
        workspaceId: workspace._id,
        universalIdentifier: standardApplicationUniversalIdentifier,
        deletedAt: { $in: [null, undefined] },
      });

      if (!standardApplication) continue;

      // ON CONFLICT (key, workspaceId) DO NOTHING equivalent
      const existing = await permissionFlagCol.findOne({
        key: definition.key,
        workspaceId: workspace._id,
      });

      if (existing) continue;

      await permissionFlagCol.insertOne({
        workspaceId: workspace._id,
        applicationId: standardApplication._id,
        universalIdentifier: definition.universalIdentifier,
        key: definition.key,
        label: definition.label,
        description: definition.description,
        icon: definition.icon,
        permissionType: definition.permissionType,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // 3. Update rolePermissionFlag.permissionFlagId where still null
  const roleRows = await rolePermissionFlagCol
    .find({ permissionFlagId: { $in: [null, undefined] } })
    .toArray();

  for (const row of roleRows) {
    const permFlag = await permissionFlagCol.findOne({
      workspaceId: row.workspaceId,
      key: row.flag,
    });

    if (!permFlag?._id) continue;

    await rolePermissionFlagCol.updateOne(
      { _id: row._id as unknown as string },
      { $set: { permissionFlagId: permFlag._id } },
    );
  }
}

export async function up(): Promise<void> {
  // No-op.
}

export async function down(): Promise<void> {
  // No-op.
}
