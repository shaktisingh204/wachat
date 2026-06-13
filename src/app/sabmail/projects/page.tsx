import { listSabmailProjects } from "@/app/actions/sabmail-projects.actions";
import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";

import { SabmailProjectsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabmailProjectsPage() {
  const [projects, activeProjectId] = await Promise.all([
    listSabmailProjects(),
    getSabmailWorkspaceId(),
  ]);

  return (
    <SabmailProjectsClient projects={projects} activeProjectId={activeProjectId} />
  );
}
