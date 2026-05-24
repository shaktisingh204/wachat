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
