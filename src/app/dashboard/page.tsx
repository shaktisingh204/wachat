

import type { Metadata } from "next";
import { getProjects } from "@/app/actions";
import { CreateProjectDialog } from "@/components/wabasimplify/project-dialog";
import { ProjectCard } from "@/components/wabasimplify/project-card";
import { FileText } from "lucide-react";
import type { WithId } from "mongodb";
import { CleanDatabaseButton } from "@/components/wabasimplify/clean-database-button";
import { SyncProjectsButton } from "@/components/wabasimplify/sync-projects-button";
import { ProjectSearch } from "@/components/wabasimplify/project-search";
import { SubscribeAllButton } from "@/components/wabasimplify/subscribe-all-button";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Select Project | Wachat",
};

export type BusinessCapabilities = {
    max_daily_conversation_per_phone: number;
    max_phone_numbers_per_business: number;
};

export type PaymentConfiguration = {
    configuration_name: string;
    provider_name: string;
    provider_mid: string;
    status: string;
    created_timestamp: number;
    updated_timestamp: number;
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

export type AutoReplySettings = {
  general?: {
    enabled: boolean;
    message: string;
  };
  inactiveHours?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
    days: number[]; // 0 = Sunday, 1 = Monday, etc.
    message: string;
  };
  aiAssistant?: {
    enabled: boolean;
    context: string;
  };
};

export type Project = {
    name: string;
    wabaId: string;
    accessToken: string;
    phoneNumbers: PhoneNumber[];
    createdAt: Date;
    messagesPerSecond?: number;
    reviewStatus?: string;
    paymentConfiguration?: PaymentConfiguration;
    businessCapabilities?: BusinessCapabilities;
    autoReplySettings?: AutoReplySettings;
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
  qualityScore?: string;
};

export type FlowNode = {
    id: string;
    type: string;
    data: any;
    position: { x: number; y: number };
};

export type FlowEdge = {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
};

export type Flow = {
    name: string;
    projectId: any;
    nodes: FlowNode[];
    edges: FlowEdge[];
    triggerKeywords: string[];
    createdAt: Date;
    updatedAt: Date;
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
                    <h1 className="text-3xl font-bold font-headline">Select a Project</h1>
                    <p className="text-muted-foreground">
                        Choose an existing project or create a new one to get started.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <SubscribeAllButton />
                    <SyncProjectsButton />
                    <CleanDatabaseButton />
                </div>
            </div>

            <div className="w-full md:max-w-sm">
                <ProjectSearch placeholder="Search projects by name..." />
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
                          {query 
                            ? "No projects matched your search."
                            : 'Click "Create New Project" to set up your first WhatsApp Business project.'
                          }
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
