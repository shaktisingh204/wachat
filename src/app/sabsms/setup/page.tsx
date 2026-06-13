import { redirect } from "next/navigation";

import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";
import { getSabsmsSetupState } from "@/app/actions/sabsms-projects.actions";

import { listProviderAccountsAction } from "../providers/actions";
import { SabsmsSetupClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabsmsSetupPage() {
  const projectId = await getSabsmsWorkspaceId();
  if (!projectId) redirect("/sabsms/projects");

  const state = await getSabsmsSetupState(projectId);
  if (!state) redirect("/sabsms/projects");
  if (state.complete) redirect("/sabsms");

  const providers = await listProviderAccountsAction();

  return (
    <SabsmsSetupClient
      projectId={projectId}
      initial={state}
      initialProviders={providers.success ? providers.accounts : []}
    />
  );
}
