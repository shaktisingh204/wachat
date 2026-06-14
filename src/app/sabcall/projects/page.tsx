import { listSabcallProjects } from "@/app/actions/sabcall-projects.actions";
import { getSabcallWorkspaceId } from "@/lib/sabcall/workspace";

import { SabcallProjectsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabcallProjectsPage() {
  const [projects, activeProjectId] = await Promise.all([
    listSabcallProjects(),
    getSabcallWorkspaceId(),
  ]);

  return (
    <SabcallProjectsClient projects={projects} activeProjectId={activeProjectId} />
  );
}
