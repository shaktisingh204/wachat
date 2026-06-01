import "server-only";

// PORT-NOTE: NestJS @Injectable service -> plain exported functions.
// TypeORM Repositories are replaced with MongoDB collection access inside each handler.
// Handler instances are constructed eagerly at module init time.
// SecretEncryptionService, EnvironmentConfigDriver are imported from ported paths.

import { connectToDatabase } from "@/lib/mongodb";

import {
  SECRET_ENCRYPTION_ROTATION_SITE_NAME,
  type SecretEncryptionRotationSiteName,
} from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/constants/secret-encryption-rotation-site-name.constant";
import { ColumnRotationSiteHandler } from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/handlers/column-rotation-site.handler";
import { ConnectionParametersRotationHandler } from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/handlers/connection-parameters-rotation.handler";
import { SensitiveConfigStorageRotationHandler } from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/handlers/sensitive-config-storage-rotation.handler";
import {
  SecretEncryptionRotationHandler,
  type SecretEncryptionRotationSiteResult,
} from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/interfaces/secret-encryption-rotation-handler.interface";
import { getSecretEncryptionService } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/secret-encryption.service";
import { computeEncryptionKeyId } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/utils/compute-encryption-key-id.util";
import { resolveEncryptionKeysOrThrow } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/utils/resolve-encryption-keys-or-throw.util";
import { getEnvironmentConfigDriver } from "@/lib/sabcrm/server/src/engine/core-modules/twenty-config/drivers/environment-config.driver";

export type RotationRunOptions = {
  site?: SecretEncryptionRotationSiteName | string;
  batchSize: number;
  dryRun: boolean;
};

export type RotationRunSummary = {
  currentEncryptionKeyId: string;
  fallbackEncryptionKeyId: string | null;
  results: SecretEncryptionRotationSiteResult[];
  totalDurationMs: number;
};

function buildHandlerMap(): Map<
  SecretEncryptionRotationSiteName,
  SecretEncryptionRotationHandler
> {
  const secretEncryptionService = getSecretEncryptionService();

  const handlers: SecretEncryptionRotationHandler[] = [
    new ColumnRotationSiteHandler(
      {
        siteName:
          SECRET_ENCRYPTION_ROTATION_SITE_NAME.CONNECTED_ACCOUNT_ACCESS_TOKEN,
        collectionName: "sabcrm_connected_account",
        encryptedColumn: "accessToken",
        isWorkspaceScoped: true,
      },
      secretEncryptionService,
    ),
    new ColumnRotationSiteHandler(
      {
        siteName:
          SECRET_ENCRYPTION_ROTATION_SITE_NAME.CONNECTED_ACCOUNT_REFRESH_TOKEN,
        collectionName: "sabcrm_connected_account",
        encryptedColumn: "refreshToken",
        isWorkspaceScoped: true,
      },
      secretEncryptionService,
    ),
    new ConnectionParametersRotationHandler(secretEncryptionService),
    new ColumnRotationSiteHandler(
      {
        siteName: SECRET_ENCRYPTION_ROTATION_SITE_NAME.APPLICATION_VARIABLE,
        collectionName: "sabcrm_application_variable",
        encryptedColumn: "value",
        isWorkspaceScoped: true,
        extraWhere: { isSecret: true },
      },
      secretEncryptionService,
    ),
    new ColumnRotationSiteHandler(
      {
        siteName:
          SECRET_ENCRYPTION_ROTATION_SITE_NAME.APPLICATION_REGISTRATION_VARIABLE,
        collectionName: "sabcrm_application_registration_variable",
        encryptedColumn: "encryptedValue",
      },
      secretEncryptionService,
    ),
    new ColumnRotationSiteHandler(
      {
        siteName: SECRET_ENCRYPTION_ROTATION_SITE_NAME.SIGNING_KEY_PRIVATE_KEY,
        collectionName: "sabcrm_signing_key",
        encryptedColumn: "privateKey",
      },
      secretEncryptionService,
    ),
    new ColumnRotationSiteHandler(
      {
        siteName: SECRET_ENCRYPTION_ROTATION_SITE_NAME.TOTP_SECRET,
        collectionName: "sabcrm_two_factor_authentication_method",
        encryptedColumn: "secret",
        isWorkspaceScoped: true,
      },
      secretEncryptionService,
    ),
    new SensitiveConfigStorageRotationHandler(secretEncryptionService),
  ];

  return new Map(handlers.map((h) => [h.siteName, h]));
}

function listSiteNames(
  handlersBySiteName: Map<SecretEncryptionRotationSiteName, SecretEncryptionRotationHandler>,
): SecretEncryptionRotationSiteName[] {
  return Array.from(handlersBySiteName.keys());
}

function resolveHandlersToRun(
  handlersBySiteName: Map<SecretEncryptionRotationSiteName, SecretEncryptionRotationHandler>,
  site: string | undefined,
): SecretEncryptionRotationHandler[] {
  if (site == null) {
    return Array.from(handlersBySiteName.values());
  }

  const handler = handlersBySiteName.get(
    site as SecretEncryptionRotationSiteName,
  );

  if (handler == null) {
    throw new Error(
      `Unknown rotation site: '${site}'. Known sites: ${listSiteNames(handlersBySiteName).join(", ")}.`,
    );
  }

  return [handler];
}

function logSummary(summary: RotationRunSummary): void {
  const totalRotated = summary.results.reduce(
    (sum, r) => sum + r.rotated,
    0,
  );
  const totalSkipped = summary.results.reduce(
    (sum, r) => sum + r.skipped,
    0,
  );
  const totalErrors = summary.results.reduce((sum, r) => sum + r.errors, 0);

  console.log("[secret-encryption:rotate] summary");

  for (const result of summary.results) {
    console.log(
      `  ${result.siteName.padEnd(36)} rotated=${result.rotated} skipped=${result.skipped} errors=${result.errors} (${result.durationMs}ms)`,
    );
  }

  console.log(
    `[secret-encryption:rotate] all sites complete in ${summary.totalDurationMs}ms — rotated=${totalRotated} skipped=${totalSkipped} errors=${totalErrors}`,
  );
}

export async function run(options: RotationRunOptions): Promise<RotationRunSummary> {
  const environmentConfigDriver = getEnvironmentConfigDriver();

  const { primary: currentEncryptionKey, fallback: fallbackEncryptionKey } =
    resolveEncryptionKeysOrThrow({ environmentConfigDriver });

  const currentEncryptionKeyId = computeEncryptionKeyId({
    rawKey: currentEncryptionKey,
  });
  const fallbackEncryptionKeyId =
    fallbackEncryptionKey != null
      ? computeEncryptionKeyId({ rawKey: fallbackEncryptionKey })
      : null;

  console.log(
    `[secret-encryption:rotate] current encryption key id: ${currentEncryptionKeyId}${options.dryRun ? " (dry-run)" : ""}`,
  );

  if (fallbackEncryptionKeyId != null) {
    console.log(
      `[secret-encryption:rotate] fallback encryption key id: ${fallbackEncryptionKeyId}`,
    );
  } else {
    console.warn(
      "[secret-encryption:rotate] FALLBACK_ENCRYPTION_KEY is not set — rows encrypted under a previous ENCRYPTION_KEY cannot be decrypted by this command.",
    );
  }

  const handlersBySiteName = buildHandlerMap();
  const handlersToRun = resolveHandlersToRun(handlersBySiteName, options.site);

  const startedAt = performance.now();
  const results: SecretEncryptionRotationSiteResult[] = [];

  for (const handler of handlersToRun) {
    const siteStartedAt = performance.now();

    const remainingBefore = await handler.countRemaining({
      currentEncryptionKeyId,
    });

    console.log(
      `[${handler.siteName}] start: ${remainingBefore} row(s) need rotation`,
    );

    const { rotated, skipped, errors } = await handler.rotate({
      currentEncryptionKeyId,
      batchSize: options.batchSize,
      dryRun: options.dryRun,
    });

    const durationMs = Math.round(performance.now() - siteStartedAt);
    const result: SecretEncryptionRotationSiteResult = {
      siteName: handler.siteName,
      remainingBefore,
      rotated,
      skipped,
      errors,
      durationMs,
    };

    results.push(result);

    console.log(
      `[${handler.siteName}] DONE in ${durationMs}ms — rotated=${rotated} skipped=${skipped} errors=${errors}`,
    );
  }

  const totalDurationMs = Math.round(performance.now() - startedAt);

  const summary: RotationRunSummary = {
    currentEncryptionKeyId,
    fallbackEncryptionKeyId,
    results,
    totalDurationMs,
  };

  logSummary(summary);

  return summary;
}
