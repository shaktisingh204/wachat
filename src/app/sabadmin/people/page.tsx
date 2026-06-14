import { redirect } from "next/navigation";

import { getSabAdminContext } from "@/lib/sabadmin/tenant";
import { listSabAdminPeople } from "@/lib/sabadmin/queries";
import { getSabAdminSettingsView } from "../actions/settings.actions";
import { getGrantableApps, listAccessPackages } from "../actions/packages.actions";
import { SabAdminPeopleClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabAdminPeoplePage() {
  const ctx = await getSabAdminContext();
  if (!ctx.ok) redirect("/dashboard");

  const [people, settings, grantableApps, packages] = await Promise.all([
    listSabAdminPeople(ctx.ctx.ownerUserId),
    getSabAdminSettingsView(),
    getGrantableApps(),
    listAccessPackages(),
  ]);

  return (
    <SabAdminPeopleClient
      initialPeople={people}
      settings={settings}
      grantableApps={grantableApps}
      packages={packages.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
