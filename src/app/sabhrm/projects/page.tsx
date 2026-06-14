import { listSabHrmProjects } from "@/app/actions/sabhrm-projects.actions";
import { getSabHrmWorkspaceId } from "@/lib/sabhrm/workspace";

import { SabHrmProjectsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabHrmProjectsPage() {
  const [projects, activeProjectId] = await Promise.all([
    listSabHrmProjects(),
    getSabHrmWorkspaceId(),
  ]);

  return (
    <SabHrmProjectsClient projects={projects} activeProjectId={activeProjectId} />
  );
}
