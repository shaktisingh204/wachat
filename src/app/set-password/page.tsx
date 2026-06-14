import { redirect } from "next/navigation";

import { getCachedSession } from "@/lib/server-cache";

import { SetPasswordClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  const session = await getCachedSession();
  if (!session?.user) redirect("/login");
  const u = session.user as { email?: string; name?: string };
  return <SetPasswordClient email={u.email ?? ""} name={u.name ?? null} />;
}
