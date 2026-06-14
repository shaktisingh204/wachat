import { redirect } from "next/navigation";

import { getSabAdminContext } from "@/lib/sabadmin/tenant";
import { getGrantableApps, listAccessPackages } from "../actions/packages.actions";
import { SabAdminAccessClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabAdminAccessPage() {
  const ctx = await getSabAdminContext();
  if (!ctx.ok) redirect("/dashboard");

  const [packages, grantableApps] = await Promise.all([
    listAccessPackages(),
    getGrantableApps(),
  ]);

  return <SabAdminAccessClient initialPackages={packages} grantableApps={grantableApps} />;
}
