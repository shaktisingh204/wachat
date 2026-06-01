import "server-only";

// PORT-NOTE: TypeORM Repository + SQL LIKE queries replaced with MongoDB collection queries.
// ACCOUNT_TYPES from twenty-shared is preserved as a local constant for the protocol loop.
// ImapSmtpCaldavParams / EncryptedImapSmtpCaldavParams are ported as local types.

import { connectToDatabase } from "@/lib/mongodb";

import { SECRET_ENCRYPTION_ROTATION_SITE_NAME } from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/constants/secret-encryption-rotation-site-name.constant";
import {
  SecretEncryptionRotationHandler,
  type SecretEncryptionRotationContext,
  type SecretEncryptionRotationOutcome,
} from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/interfaces/secret-encryption-rotation-handler.interface";
import { buildCurrentEncryptionKeyIdEnvelopeLikePattern } from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/utils/build-current-encryption-key-id-envelope-like-pattern.util";
import { buildRotationErrorMessage } from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/utils/build-rotation-error-message.util";
import {
  SecretEncryptionException,
  SecretEncryptionExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/exceptions/secret-encryption.exception";
import { type SecretEncryptionService } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/secret-encryption.service";
import { SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/constants/secret-encryption.constant";

// PORT-NOTE: twenty-shared ACCOUNT_TYPES — preserving inline to avoid dependency drift.
const ACCOUNT_TYPES = ["IMAP", "SMTP", "CALDAV"] as const;
type AccountProtocol = (typeof ACCOUNT_TYPES)[number];

type ProtocolParams = {
  password: string;
  [key: string]: unknown;
};

export type ImapSmtpCaldavParams = {
  [P in AccountProtocol]?: ProtocolParams;
};

export type EncryptedImapSmtpCaldavParams = ImapSmtpCaldavParams;

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const COLLECTION = "sabcrm_connected_account";

export class ConnectionParametersRotationHandler extends SecretEncryptionRotationHandler {
  readonly siteName =
    SECRET_ENCRYPTION_ROTATION_SITE_NAME.CONNECTED_ACCOUNT_CONNECTION_PARAMETERS;

  constructor(
    private readonly secretEncryptionService: SecretEncryptionService,
  ) {
    super();
  }

  private async getCollection() {
    const { db } = await connectToDatabase();
    return db.collection<Record<string, unknown>>(COLLECTION);
  }

  private buildNeedRotationFilter(currentEncryptionKeyId: string) {
    const currentEnvelopePrefix = buildCurrentEncryptionKeyIdEnvelopeLikePattern(
      currentEncryptionKeyId,
    ).replace(/%$/, "");
    const notCurrent = new RegExp(
      `^${currentEnvelopePrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    );

    return {
      connectionParameters: { $ne: null },
      $or: [
        {
          "connectionParameters.IMAP.password": { $exists: true, $not: notCurrent },
        },
        {
          "connectionParameters.SMTP.password": { $exists: true, $not: notCurrent },
        },
        {
          "connectionParameters.CALDAV.password": {
            $exists: true,
            $not: notCurrent,
          },
        },
      ],
    };
  }

  async countRemaining({
    currentEncryptionKeyId,
  }: {
    currentEncryptionKeyId: string;
  }): Promise<number> {
    const collection = await this.getCollection();
    return collection.countDocuments(
      this.buildNeedRotationFilter(currentEncryptionKeyId),
    );
  }

  async rotate({
    currentEncryptionKeyId,
    batchSize,
    dryRun,
  }: SecretEncryptionRotationContext): Promise<SecretEncryptionRotationOutcome> {
    const outcome: SecretEncryptionRotationOutcome = {
      rotated: 0,
      skipped: 0,
      errors: 0,
    };

    const collection = await this.getCollection();
    const filter = this.buildNeedRotationFilter(currentEncryptionKeyId);
    let cursor = ZERO_UUID;

    while (true) {
      const rows = await collection
        .find({ ...filter, id: { $gt: cursor } })
        .sort({ id: 1 })
        .limit(batchSize)
        .toArray();

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        const originalConnectionParameters = row.connectionParameters as
          | EncryptedImapSmtpCaldavParams
          | null
          | undefined;

        if (originalConnectionParameters == null) {
          outcome.skipped += 1;
          continue;
        }

        let reEncryptedConnectionParameters: EncryptedImapSmtpCaldavParams;

        try {
          reEncryptedConnectionParameters =
            this.reEncryptConnectionParametersOrThrow({
              connectionParameters: originalConnectionParameters,
              workspaceId: row.workspaceId as string,
            });
        } catch (error) {
          console.error(
            buildRotationErrorMessage(
              this.siteName,
              row.id as string,
              error,
            ),
          );
          outcome.errors += 1;
          continue;
        }

        if (dryRun) {
          outcome.rotated += 1;
          continue;
        }

        const updateResult = await collection.updateOne(
          {
            id: row.id,
            connectionParameters: originalConnectionParameters,
          },
          { $set: { connectionParameters: reEncryptedConnectionParameters } },
        );

        if (updateResult.modifiedCount === 0) {
          outcome.skipped += 1;
          continue;
        }

        outcome.rotated += 1;
      }

      cursor = rows[rows.length - 1].id as string;
    }

    return outcome;
  }

  private reEncryptConnectionParametersOrThrow({
    connectionParameters,
    workspaceId,
  }: {
    connectionParameters: EncryptedImapSmtpCaldavParams;
    workspaceId: string;
  }): EncryptedImapSmtpCaldavParams {
    const result: EncryptedImapSmtpCaldavParams = { ...connectionParameters };

    for (const protocol of ACCOUNT_TYPES) {
      const params = connectionParameters[protocol];

      if (params == null) {
        continue;
      }

      if (!params.password.startsWith(SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX)) {
        throw new SecretEncryptionException(
          `${protocol} password is not a versioned envelope (expected '${SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX}…'), refusing to rotate.`,
          SecretEncryptionExceptionCode.MALFORMED_ENVELOPE,
        );
      }

      const plaintext = this.secretEncryptionService.decryptVersioned(
        params.password,
        { workspaceId },
      );

      result[protocol] = {
        ...params,
        password: this.secretEncryptionService.encryptVersioned(plaintext, {
          workspaceId,
        }),
      };
    }

    return result;
  }
}
