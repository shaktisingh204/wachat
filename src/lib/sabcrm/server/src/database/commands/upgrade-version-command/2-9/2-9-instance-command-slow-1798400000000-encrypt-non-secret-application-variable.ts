import "server-only";

// PORT-NOTE: SlowInstanceCommand — batch-encrypts non-secret applicationVariable rows.
// Original iterates Postgres "core".applicationVariable rows.
// SabNode port iterates the sabcrm_applicationVariable MongoDB collection.

import { connectToDatabase } from "@/lib/mongodb";

export const SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX = "enc:v2:";
const V2_ENCRYPTED_LIKE_PATTERN_PREFIX = SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX;

const BACKFILL_BATCH_SIZE = 500;
const VALUE_CHECK_CONSTRAINT_NAME = "CHK_applicationVariable_value_encrypted";

export type PlaintextString = string & { readonly __brand: "PlaintextString" };

export interface EncryptedString {
  readonly __brand: "EncryptedString";
}

type ApplicationVariableRow = {
  _id: string;
  workspaceId: string;
  value: string;
  isSecret?: boolean;
};

export interface SecretEncryptionService {
  encryptVersioned(
    value: PlaintextString,
    context: { workspaceId: string },
  ): string;
}

function isEncryptedString(value: string): boolean {
  return value.startsWith(SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX);
}

/**
 * v2.9.0 — slow instance command #1798400000000
 * Encrypts all remaining plaintext non-secret applicationVariable rows into
 * the enc:v2 envelope, then tightens the CHECK constraint to require encryption
 * for ALL rows (not just isSecret=true ones).
 *
 * PORT-NOTE: The Postgres CHECK constraint step (up/down) has no MongoDB analogue.
 * Enforce the invariant at the application layer via a Zod schema on write.
 */
export class EncryptNonSecretApplicationVariableSlowInstanceCommand {
  readonly version = "2.9.0";
  readonly timestamp = 1798400000000;
  readonly type = "slow" as const;

  private readonly logger = {
    log: (msg: string) => console.log(`[EncryptNonSecretApplicationVariable] ${msg}`),
    error: (msg: string) => console.error(`[EncryptNonSecretApplicationVariable] ${msg}`),
  };

  constructor(
    private readonly secretEncryptionService: SecretEncryptionService,
  ) {}

  async runDataMigration(): Promise<void> {
    const { db } = await connectToDatabase();
    const collection = db.collection<ApplicationVariableRow>(
      "sabcrm_applicationVariable",
    );

    let cursor = "00000000-0000-0000-0000-000000000000";
    let totalEncrypted = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const rows = await collection
        .find({
          _id: { $gt: cursor as unknown as never },
          isSecret: { $ne: true },
          value: {
            $ne: "",
            $not: { $regex: `^${V2_ENCRYPTED_LIKE_PATTERN_PREFIX}` },
          },
        })
        .sort({ _id: 1 })
        .limit(BACKFILL_BATCH_SIZE)
        .toArray();

      if (rows.length === 0) {
        break;
      }

      let batchEncrypted = 0;

      for (const row of rows) {
        if (isEncryptedString(row.value)) {
          continue;
        }

        const encryptedValue = this.secretEncryptionService.encryptVersioned(
          row.value as PlaintextString,
          { workspaceId: row.workspaceId },
        );

        await collection.updateOne(
          { _id: row._id as unknown as never },
          { $set: { value: encryptedValue } },
        );

        batchEncrypted++;
      }

      totalEncrypted += batchEncrypted;
      cursor = rows[rows.length - 1]._id;

      this.logger.log(
        `Encrypted ${batchEncrypted} non-secret application variables in this batch (${totalEncrypted} total so far)`,
      );
    }

    this.logger.log(
      `Finished encrypting non-secret application variables: ${totalEncrypted} rows encrypted`,
    );
  }

  public async up(): Promise<void> {
    // PORT-NOTE: The Postgres step drops the old CHECK constraint and adds a tighter one
    // requiring ALL values to start with 'enc:v2:'. MongoDB has no CHECK constraints.
    // Enforce via application-layer validation (Zod schema: z.string().startsWith('enc:v2:').or(z.literal(''))).
    this.logger.log(
      `[${VALUE_CHECK_CONSTRAINT_NAME}] PORT-NOTE: Postgres CHECK constraint — no MongoDB analogue. Enforce at application layer.`,
    );
  }

  public async down(): Promise<void> {
    // PORT-NOTE: Restores the previous Postgres CHECK constraint that allowed plaintext
    // for non-secret rows. No MongoDB analogue.
    this.logger.log(
      `[${VALUE_CHECK_CONSTRAINT_NAME}] PORT-NOTE: Postgres CHECK constraint rollback — no MongoDB analogue.`,
    );
  }
}
