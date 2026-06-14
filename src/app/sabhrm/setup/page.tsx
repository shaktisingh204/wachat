import { redirect } from "next/navigation";

import { getActiveSabHrmProject } from "@/lib/sabhrm/workspace";
import { getSabHrmSetupState } from "@/app/actions/sabhrm-projects.actions";

import { SabHrmSetupClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabHrmSetupPage() {
  const project = await getActiveSabHrmProject();
  if (!project) redirect("/sabhrm/projects");

  const state = await getSabHrmSetupState(String(project._id));
  if (!state) redirect("/sabhrm/projects");
  if (state.complete) redirect("/sabhrm");

  return <SabHrmSetupClient state={state} />;
}
