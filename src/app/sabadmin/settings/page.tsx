import { redirect } from "next/navigation";

import { getSabAdminContext } from "@/lib/sabadmin/tenant";
import { getSabAdminSettingsView } from "../actions/settings.actions";
import { SabAdminSettingsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabAdminSettingsPage() {
  const ctx = await getSabAdminContext();
  if (!ctx.ok) redirect("/dashboard");

  const settings = await getSabAdminSettingsView();
  if (!settings) redirect("/dashboard");

  return <SabAdminSettingsClient initial={settings} />;
}
