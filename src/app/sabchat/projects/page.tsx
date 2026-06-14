import { listSabchatProjects } from "@/app/actions/sabchat-projects.actions";
import { getSabchatWorkspaceId } from "@/lib/sabchat/workspace";

import { SabchatProjectsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabchatProjectsPage() {
  const [projects, activeProjectId] = await Promise.all([
    listSabchatProjects(),
    getSabchatWorkspaceId(),
  ]);

  return (
    <SabchatProjectsClient
      projects={projects}
      activeProjectId={activeProjectId}
    />
  );
}
