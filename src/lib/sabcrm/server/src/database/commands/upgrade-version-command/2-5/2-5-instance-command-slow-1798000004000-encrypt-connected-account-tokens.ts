import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: This was a TypeORM/Postgres slow instance command that:
//   1. (runDataMigration) Batch-encrypted plaintext accessToken/refreshToken
//      rows in connectedAccount using ConnectedAccountTokenEncryptionService.
//   2. (up) Added two CHECK constraints enforcing the v2 envelope on both
//      token columns.
//   3. (down) Dropped both CHECK constraints (but intentionally did NOT
//      decrypt, to avoid a security regression).
//
// In MongoDB:
//   - CHECK constraints do not exist. Enforcement is done at the application
//     layer (ConnectedAccountTokenEncryptionService) before writes.
//   - The data-migration backfill IS ported: we scan sabcrm_connectedaccount
//     in batches and call the encryption service for any plaintext values.
//   - Because NestJS DI is unavailable, the encryption service must be
//     instantiated or imported directly by the caller. This module exports a
//     runDataMigration function that accepts the service as a parameter.

export const VERSION = '2.5.0';
export const TIMESTAMP = 1798000004000;

const BACKFILL_BATCH_SIZE = 500;
const SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX = 'v2:';

type ConnectedAccountTokenRow = {
  _id: string;
  workspaceId: string;
  accessToken: string | null;
  refreshToken: string | null;
};

type EncryptFn = (opts: {
  plaintext: string;
  workspaceId: string;
}) => string;

const isPlaintext = (value: string | null): value is string =>
  value !== null && value !== undefined && !value.startsWith(SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX);

export async function runDataMigration(encryptFn: EncryptFn): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection<ConnectedAccountTokenRow>('sabcrm_connectedaccount');

  let lastId: string | null = null;

  while (true) {
    const filter: Record<string, unknown> = {
      $or: [
        { accessToken: { $nin: [null, undefined], $not: /^v2:/ } },
        { refreshToken: { $nin: [null, undefined], $not: /^v2:/ } },
      ],
    };

    if (lastId !== null) {
      filter['_id'] = { $gt: lastId };
    }

    const rows = await col
      .find(filter)
      .sort({ _id: 1 })
      .limit(BACKFILL_BATCH_SIZE)
      .toArray();

    if (rows.length === 0) break;

    for (const row of rows) {
      const updates: Record<string, string> = {};

      if (isPlaintext(row.accessToken)) {
        updates.accessToken = encryptFn({
          plaintext: row.accessToken,
          workspaceId: row.workspaceId,
        });
      }

      if (isPlaintext(row.refreshToken)) {
        updates.refreshToken = encryptFn({
          plaintext: row.refreshToken,
          workspaceId: row.workspaceId,
        });
      }

      if (Object.keys(updates).length > 0) {
        await col.updateOne({ _id: row._id as unknown as string }, { $set: updates });
      }
    }

    lastId = rows[rows.length - 1]._id;
  }
}

export async function up(): Promise<void> {
  // No-op: MongoDB has no CHECK constraints. Enforcement is done at the
  // application layer by ConnectedAccountTokenEncryptionService.
}

export async function down(): Promise<void> {
  // No-op: intentionally do not decrypt rows on rollback (security regression).
}
