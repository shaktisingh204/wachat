/**
 * /sabsms/providers/[id] — provider account detail.
 *
 * Server component: resolves the workspace via the session, loads the
 * account through `getProviderAccountAction` (masked credentials only —
 * plaintext never leaves the server), and mounts the client detail
 * surface. Async params per Next.js 16.
 */

import { redirect } from "next/navigation";

import { getCachedSession } from "@/lib/server-cache";

import { getProviderAccountAction } from "../actions";
import { ProviderDetailClient } from "./provider-detail-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabsmsProviderDetailPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");
  if (!workspaceId) redirect("/sabsms/providers");

  const res = await getProviderAccountAction(id);
  if (!res.success) redirect("/sabsms/providers");

  return <ProviderDetailClient account={res.account} />;
}
