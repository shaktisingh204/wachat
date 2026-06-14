import { redirect } from "next/navigation";

import { getActiveSabsignProject } from "@/lib/sabsign/workspace";
import { getSabsignSetupState } from "@/app/actions/sabsign-projects.actions";

import { SetupClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabsignSetupPage() {
  const project = await getActiveSabsignProject();
  if (!project) redirect("/sabsign/projects");

  const state = await getSabsignSetupState(String(project._id));
  if (!state) redirect("/sabsign/projects");
  if (state.complete) redirect("/sabsign");

  return <SetupClient state={state} />;
}
