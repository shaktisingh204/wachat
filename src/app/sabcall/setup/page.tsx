import { redirect } from "next/navigation";

import { getSabcallWorkspaceId } from "@/lib/sabcall/workspace";
import { getSabcallSetupState } from "@/app/actions/sabcall-projects.actions";

import { SabcallSetupClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabcallSetupPage() {
  const projectId = await getSabcallWorkspaceId();
  if (!projectId) redirect("/sabcall/projects");

  const state = await getSabcallSetupState(projectId);
  if (!state) redirect("/sabcall/projects");
  if (state.complete) redirect("/sabcall");

  return <SabcallSetupClient projectId={projectId} initial={state} />;
}
