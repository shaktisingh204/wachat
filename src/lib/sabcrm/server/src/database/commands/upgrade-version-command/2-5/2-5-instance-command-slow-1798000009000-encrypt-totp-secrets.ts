import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: This was a TypeORM/Postgres slow instance command that:
//   1. (runDataMigration) Re-encrypted twoFactorAuthenticationMethod.secret
//      rows from the old SimpleSecretEncryptionUtil (CTR) format into the
//      workspace-scoped v2 versioned envelope, joining userWorkspace to
//      resolve the userId + workspaceId used as the old CTR key derivation.
//   2. (up) Added a CHECK constraint: secret LIKE 'v2:%'.
//   3. (down) Dropped the CHECK constraint.
//
// In MongoDB:
//   - CHECK constraints do not exist; enforcement is at the application layer.
//   - The backfill IS ported scanning sabcrm_twofactorauthenticationmethod
//     and joining sabcrm_userworkspace.
//   - Encryption/decryption callbacks are injected to avoid NestJS DI.

export const VERSION = '2.5.0';
export const TIMESTAMP = 1798000009000;

const BACKFILL_BATCH_SIZE = 500;
const SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX = 'v2:';

type TwoFactorMethodDoc = {
  _id: string;
  userWorkspaceId: string;
  secret: string;
  workspaceId?: string;
};

type UserWorkspaceDoc = {
  _id: string;
  userId: string;
};

type DecryptLegacyFn = (
  secret: string,
  context: string,
) => Promise<string | null>;

type EncryptVersionedFn = (
  plaintext: string,
  opts: { workspaceId: string },
) => string;

export async function runDataMigration(
  encryptVersioned: EncryptVersionedFn,
  decryptLegacy: DecryptLegacyFn,
): Promise<void> {
  const { db } = await connectToDatabase();
  const methodCol = db.collection<TwoFactorMethodDoc>(
    'sabcrm_twofactorauthenticationmethod',
  );
  const userWorkspaceCol = db.collection<UserWorkspaceDoc>(
    'sabcrm_userworkspace',
  );

  let lastId: string | null = null;

  while (true) {
    const filter: Record<string, unknown> = {
      secret: {
        $not: new RegExp(`^${SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX}`),
      },
    };

    if (lastId !== null) {
      filter['_id'] = { $gt: lastId };
    }

    const rows = await methodCol
      .find(filter)
      .sort({ _id: 1 })
      .limit(BACKFILL_BATCH_SIZE)
      .toArray();

    if (rows.length === 0) break;

    for (const row of rows) {
      const userWorkspace = await userWorkspaceCol.findOne({
        _id: row.userWorkspaceId as unknown as string,
      });

      if (!userWorkspace || !row.workspaceId) continue;

      const context = `${userWorkspace.userId}${row.workspaceId}otp-secret`;
      const plaintext = await decryptLegacy(row.secret, context);

      if (plaintext === null) continue;

      const encryptedValue = encryptVersioned(plaintext, {
        workspaceId: row.workspaceId,
      });

      await methodCol.updateOne(
        { _id: row._id as unknown as string },
        { $set: { secret: encryptedValue } },
      );
    }

    lastId = rows[rows.length - 1]._id;
  }
}

export async function up(): Promise<void> {
  // No-op: MongoDB has no CHECK constraints.
  // Constraint semantics: secret LIKE 'v2:%' enforced by application layer.
}

export async function down(): Promise<void> {
  // No-op: intentionally do not decrypt rows on rollback.
}
