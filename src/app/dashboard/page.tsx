
import type { Metadata } from "next";
import { getProjects, handleCleanDatabase } from "@/app/actions";
import { CreateProjectDialog } from "@/components/wabasimplify/project-dialog";
import { ProjectCard } from "@/components/wabasimplify/project-card";
import { FileText } from "lucide-react";
import type { WithId } from "mongodb";
import { CleanDatabaseButton } from "@/components/wabasimplify/clean-database-button";
import { SyncProjectsButton } from "@/components/wabasimplify/sync-projects-button";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Select Project | Wachat",
};

export type PhoneNumber = {
    id: string;
    display_phone_number: string;
    verified_name: string;
    code_verification_status: string;
    quality_rating: string;
    platform_type?: string;
    throughput?: {
        level: string;
    };
};

export type Project = {
    name: string;
    wabaId: string;
    accessToken: string;
    phoneNumbers: PhoneNumber[];
    createdAt: Date;
    messagesPerSecond?: number;
};

export type Template = {
  name: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  body: string;
  language: string;
  status: string;
  components: any[];
  metaId: string;
  headerSampleUrl?: string;
};

export default async function SelectProjectPage() {
    const projects: WithId<Project>[] = await getProjects();

    return (
        <div className="flex flex-col gap-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Select a Project</h1>
                    <p className="text-muted-foreground">
                        Choose an existing project or create a new one to get started.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <SyncProjectsButton />
                    <CleanDatabaseButton />
                </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {projects.map((project) => (
                    <ProjectCard key={project._id.toString()} project={project} />
                ))}
                <CreateProjectDialog />
            </div>

            {projects.length === 0 && (
                 <div className="col-span-full">
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-20 text-center">
                        <FileText className="h-12 w-12 text-muted-foreground" />
                        <h3 className="text-xl font-semibold mt-4">No Projects Found</h3>
                        <p className="text-muted-foreground mt-2">
                        Click "Create New Project" to set up your first WhatsApp Business project.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

    
