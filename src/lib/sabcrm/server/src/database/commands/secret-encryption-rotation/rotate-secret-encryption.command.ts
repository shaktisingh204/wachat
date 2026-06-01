import "server-only";

// PORT-NOTE: NestJS @Command CLI runner -> exported async function.
// Preserves all option parsing logic as typed function arguments.

import {
  SECRET_ENCRYPTION_ROTATION_SITE_NAME,
} from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/constants/secret-encryption-rotation-site-name.constant";
import { run as runSecretEncryptionRotation } from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/services/secret-encryption-rotation-runner.service";

const DEFAULT_BATCH_SIZE = 200;
const MAX_BATCH_SIZE = 5000;

export const KNOWN_SITE_NAMES = Object.values(
  SECRET_ENCRYPTION_ROTATION_SITE_NAME,
).join(", ");

export type RotateSecretEncryptionCommandOptions = {
  site?: string;
  batchSize?: number;
  dryRun?: boolean;
};

/**
 * Re-encrypts every at-rest secret stored in an enc:v2 envelope using the
 * current ENCRYPTION_KEY. Idempotent: rows already on the current key are
 * skipped. Requires FALLBACK_ENCRYPTION_KEY when rotating to a fresh key.
 *
 * Equivalent to the Twenty `secret-encryption:rotate` CLI command.
 */
export async function rotateSecretEncryption(
  options: RotateSecretEncryptionCommandOptions = {},
): Promise<void> {
  const batchSize = Math.min(
    options.batchSize ?? DEFAULT_BATCH_SIZE,
    MAX_BATCH_SIZE,
  );

  const summary = await runSecretEncryptionRotation({
    site: options.site,
    batchSize,
    dryRun: options.dryRun ?? false,
  });

  const totalErrors = summary.results.reduce(
    (sum, result) => sum + result.errors,
    0,
  );

  if (totalErrors > 0) {
    throw new Error(
      `secret-encryption:rotate completed with ${totalErrors} error(s) — see logs above.`,
    );
  }
}
