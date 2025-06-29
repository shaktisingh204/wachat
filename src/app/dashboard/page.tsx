







import type { Metadata } from "next";
import Link from 'next/link';
import { getProjects } from "@/app/actions";
import { ProjectCard } from "@/components/wabasimplify/project-card";
import { FileText, PlusCircle } from "lucide-react";
import type { WithId, ObjectId } from "mongodb";
import { SyncProjectsButton } from "@/components/wabasimplify/sync-projects-button";
import { SubscribeAllButton } from "@/components/wabasimplify/subscribe-all-button";
import { ProjectSearch } from "@/components/wabasimplify/project-search";
import { Button } from "@/components/ui/button";

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
  masterEnabled?: boolean;
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
    userId: ObjectId;
    name: string;
    wabaId: string;
    appId?: string;
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
                 <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
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
