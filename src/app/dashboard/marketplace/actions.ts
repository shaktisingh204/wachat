"use server";

import { installApp } from "@/lib/marketplace/install";
import { getCachedSession } from "@/lib/server-cache";

export async function installMarketplaceAppAction(appId: string) {
  const session = await getCachedSession();
  const userId = session?.user?._id;
  if (!userId) {
    throw new Error("Unauthorized");
  }

  await installApp(userId.toString(), appId);
}

import { submitReview } from "@/lib/marketplace/reviews";

export async function submitAppReviewAction(appId: string, rating: number, body?: string) {
  const session = await getCachedSession();
  const userId = session?.user?._id;
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Assuming tenantId is userId here as in installAppAction
  await submitReview(appId, userId.toString(), userId.toString(), rating, body);
}
