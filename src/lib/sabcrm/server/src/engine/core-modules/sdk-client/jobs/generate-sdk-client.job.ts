import "server-only";

// PORT-NOTE: NestJS BullMQ @Processor / @Process decorators replaced with a plain
// async handler function. In SabNode the job queue is driven by a custom message-queue
// helper (or by a Next.js route that enqueues work). Register this handler with whatever
// queue infrastructure SabNode uses (e.g. BullMQ directly, or the sabcrm message-queue service).

import {
  GENERATE_SDK_CLIENT_JOB_NAME,
  type GenerateSdkClientJobData,
} from "@/lib/sabcrm/server/src/engine/core-modules/sdk-client/jobs/generate-sdk-client.job-constants";
import { generateSdkClientForApplication } from "@/lib/sabcrm/server/src/engine/core-modules/sdk-client/sdk-client-generation.service";

export { GENERATE_SDK_CLIENT_JOB_NAME };

/**
 * Job handler for generating an SDK client bundle for a workspace application.
 * Wire this into SabNode's message-queue / BullMQ worker.
 */
export async function handleGenerateSdkClientJob(
  data: GenerateSdkClientJobData,
): Promise<void> {
  await generateSdkClientForApplication({
    workspaceId: data.workspaceId,
    applicationId: data.applicationId,
    applicationUniversalIdentifier: data.applicationUniversalIdentifier,
  });
}
