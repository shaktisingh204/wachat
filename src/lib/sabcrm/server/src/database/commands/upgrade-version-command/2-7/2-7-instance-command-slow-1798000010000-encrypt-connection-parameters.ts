import "server-only";

// PORT-NOTE: SlowInstanceCommand — iterates over Postgres "core".connectedAccount rows,
// encrypting plaintext IMAP/SMTP/CALDAV passwords into the enc:v2 envelope, then
// adds a CHECK constraint. SabNode stores connectedAccount data in MongoDB (sabcrm_connectedAccount).
// The encryption logic is preserved faithfully; the Postgres query runner / DataSource is
// replaced by MongoDB collection access stubs with PORT-NOTEs.

import { connectToDatabase } from "@/lib/mongodb";

export const SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX = "enc:v2:";

export type PlaintextString = string & { readonly __brand: "PlaintextString" };

export type ImapSmtpCaldavProtocolParams = {
  password?: string;
  host?: string;
  port?: number;
  [key: string]: unknown;
};

export type ImapSmtpCaldavParams = {
  IMAP?: ImapSmtpCaldavProtocolParams;
  SMTP?: ImapSmtpCaldavProtocolParams;
  CALDAV?: ImapSmtpCaldavProtocolParams;
};

export type PlaintextImapSmtpCaldavParams = {
  IMAP?: ImapSmtpCaldavProtocolParams & { password: PlaintextString };
  SMTP?: ImapSmtpCaldavProtocolParams & { password: PlaintextString };
  CALDAV?: ImapSmtpCaldavProtocolParams & { password: PlaintextString };
};

export type EncryptedImapSmtpCaldavParams = {
  IMAP?: ImapSmtpCaldavProtocolParams;
  SMTP?: ImapSmtpCaldavProtocolParams;
  CALDAV?: ImapSmtpCaldavProtocolParams;
};

const ACCOUNT_TYPES = ["IMAP", "SMTP", "CALDAV"] as const;

const BACKFILL_BATCH_SIZE = 500;

type ConnectionParametersRow = {
  _id: string;
  workspaceId: string;
  connectionParameters: ImapSmtpCaldavParams | null;
};

function isDefined<T>(val: T | null | undefined): val is T {
  return val !== null && val !== undefined;
}

const hasPlaintextPassword = (params: ImapSmtpCaldavParams): boolean => {
  for (const protocol of ACCOUNT_TYPES) {
    const protocolParams = params[protocol];
    if (
      isDefined(protocolParams?.password) &&
      !protocolParams.password.startsWith(SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX)
    ) {
      return true;
    }
  }
  return false;
};

// Encryption service interface — provide a real implementation via DI or closure.
export interface ConnectedAccountTokenEncryptionService {
  encryptConnectionParameters(args: {
    connectionParameters: PlaintextImapSmtpCaldavParams;
    workspaceId: string;
  }): EncryptedImapSmtpCaldavParams;
}

/**
 * v2.7.0 — slow instance command #1798000010000
 * Encrypts plaintext IMAP/SMTP/CALDAV passwords stored in connectedAccount.connectionParameters.
 *
 * PORT-NOTE: The original command uses a TypeORM DataSource + QueryRunner against Postgres.
 * The SabNode port operates against MongoDB (sabcrm_connectedAccount collection).
 * The CHECK constraint step (up/down) has no Mongo equivalent and is documented below.
 */
export class EncryptConnectionParametersSlowInstanceCommand {
  readonly version = "2.7.0";
  readonly timestamp = 1798000010000;
  readonly type = "slow" as const;

  constructor(
    private readonly connectedAccountTokenEncryptionService: ConnectedAccountTokenEncryptionService,
  ) {}

  async runDataMigration(): Promise<void> {
    const { db } = await connectToDatabase();
    const collection = db.collection<ConnectionParametersRow>(
      "sabcrm_connectedAccount",
    );

    let cursor = "00000000-0000-0000-0000-000000000000";

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const rows = await collection
        .find({
          _id: { $gt: cursor as unknown as never },
          connectionParameters: { $ne: null },
        })
        .sort({ _id: 1 })
        .limit(BACKFILL_BATCH_SIZE)
        .toArray();

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        if (!isDefined(row.connectionParameters)) {
          continue;
        }

        if (!hasPlaintextPassword(row.connectionParameters)) {
          continue;
        }

        const plaintextOnly: PlaintextImapSmtpCaldavParams = {};

        for (const protocol of ACCOUNT_TYPES) {
          const protocolParams = row.connectionParameters[protocol];

          if (
            isDefined(protocolParams?.password) &&
            !protocolParams.password.startsWith(
              SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX,
            )
          ) {
            plaintextOnly[protocol] = {
              ...protocolParams,
              password: protocolParams.password as PlaintextString,
            };
          }
        }

        const encrypted =
          this.connectedAccountTokenEncryptionService.encryptConnectionParameters(
            {
              connectionParameters: plaintextOnly,
              workspaceId: row.workspaceId,
            },
          );

        const merged: EncryptedImapSmtpCaldavParams = {
          ...(row.connectionParameters as EncryptedImapSmtpCaldavParams),
          ...encrypted,
        };

        await collection.updateOne(
          { _id: row._id as unknown as never },
          { $set: { connectionParameters: merged } },
        );
      }

      cursor = rows[rows.length - 1]._id;
    }
  }

  public async up(): Promise<void> {
    // PORT-NOTE: The Postgres step adds a CHECK constraint to core.connectedAccount
    // verifying all IMAP/SMTP/CALDAV passwords start with 'enc:v2:'.
    // MongoDB has no DDL CHECK constraints. Enforce this invariant at the application
    // layer (e.g., via a Zod schema on write) instead.
  }

  public async down(): Promise<void> {
    // PORT-NOTE: Drops the Postgres CHECK constraint. No Mongo analogue needed.
  }
}
