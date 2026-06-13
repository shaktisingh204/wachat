import { listSabsmsProjects } from "@/app/actions/sabsms-projects.actions";
import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";

import { SabsmsProjectsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabsmsProjectsPage() {
  const [projects, activeProjectId] = await Promise.all([
    listSabsmsProjects(),
    getSabsmsWorkspaceId(),
  ]);

  return (
    <SabsmsProjectsClient projects={projects} activeProjectId={activeProjectId} />
  );
}
