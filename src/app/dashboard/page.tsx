

import type { Metadata } from "next";
import Link from 'next/link';
import { getProjects } from "@/app/actions";
import { ProjectCard } from "@/components/wabasimplify/project-card";
import { FileText, PlusCircle } from "lucide-react";
import type { WithId } from "mongodb";
import { SyncProjectsButton } from "@/components/wabasimplify/sync-projects-button";
import { SubscribeAllButton } from "@/components/wabasimplify/subscribe-all-button";
import { ProjectSearch } from "@/components/wabasimplify/project-search";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/definitions";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Select Project | Wachat",
};

export default async function SelectProjectPage({
  searchParams,
}: {
  searchParams?: {
    query?: string;
  };
}) {
    const query = searchParams?.query || '';
    const projects: WithId<Project>[] = await getProjects(query);

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap justify-between items-start gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Select a Project ({projects.length})</h1>
                    <p className="text-muted-foreground">
                        Choose an existing project or connect a new one to get started.
                    </p>
                </div>
                 <div className="flex flex-wrap items-center gap-2">
                    <SubscribeAllButton />
                    <SyncProjectsButton />
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-grow md:max-w-sm">
                  <ProjectSearch placeholder="Search projects by name..." />
              </div>
              <Button asChild>
                  <Link href="/dashboard/setup">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Connect New Project
                  </Link>
              </Button>
            </div>

            {projects.length > 0 ? (
                 <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                    {projects.map((project) => (
                        <ProjectCard key={project._id.toString()} project={project} />
                    ))}
                </div>
            ) : (
                 <div className="col-span-full">
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-20 text-center">
                        <FileText className="h-12 w-12 text-muted-foreground" />
                        <h3 className="text-xl font-semibold mt-4">No Projects Found</h3>
                        <p className="text-muted-foreground mt-2 max-w-sm">
                          {query 
                            ? "No projects matched your search."
                            : "You haven't connected any WhatsApp Business Accounts yet. Click 'Connect New Project' to get started."
                          }
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
