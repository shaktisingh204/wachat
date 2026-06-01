import "server-only";

// PORT-NOTE: Original is a NestJS BullMQ @Processor job.
// Ported to a plain exported async function to be called from a Vercel Cron
// API route at schedule "0 * * * *" (hourly).

import { connectToDatabase } from "@/lib/mongodb";

export const CHECK_CUSTOM_DOMAIN_VALID_RECORDS_CRON_PATTERN = "0 * * * *";

type WorkspaceRow = {
  id: string;
  customDomain: string | null;
  isCustomDomainEnabled: boolean;
};

// PORT-NOTE: CustomDomainManagerService.checkCustomDomainValidRecords must be
// provided by the caller. Inject your domain-checking service at the route layer.
export async function handleCheckCustomDomainValidRecords(
  checkCustomDomainValidRecords: (workspace: WorkspaceRow) => Promise<void>,
): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection<WorkspaceRow & { activationStatus: string }>(
    "sabcrm_workspace",
  );

  const currentHour = new Date().getUTCHours();

  // PORT-NOTE: The original Postgres query filters by createdAt hour == current hour.
  // MongoDB equivalent uses $expr + $hour on the UTC createdAt field.
  const workspaces = await col
    .find(
      {
        activationStatus: "ACTIVE",
        customDomain: { $ne: null, $exists: true },
        $expr: {
          $eq: [{ $hour: "$createdAt" }, currentHour],
        },
      },
      {
        projection: { id: 1, customDomain: 1, isCustomDomainEnabled: 1 },
      },
    )
    .toArray();

  for (const workspace of workspaces) {
    try {
      await checkCustomDomainValidRecords(workspace);
    } catch (error) {
      throw new Error(
        `[CheckCustomDomainValidRecordsCronJob] Cannot check custom domain for workspaces: ${(error as Error).message}`,
      );
    }
  }
}
