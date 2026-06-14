import { listSabsignProjects } from "@/app/actions/sabsign-projects.actions";

import { ProjectsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabsignProjectsPage() {
  const projects = await listSabsignProjects();
  return <ProjectsClient initialProjects={projects} />;
}
