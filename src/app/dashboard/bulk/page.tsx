
'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getProjects, getTemplates } from '@/app/actions';
import { ProjectCard } from '@/components/wabasimplify/project-card';
import { Button } from '@/components/ui/button';
import { ProjectSearch } from '@/components/wabasimplify/project-search';
import { SyncProjectsDialog } from '@/components/wabasimplify/sync-projects-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, PlusCircle, Rows, Briefcase, Folder } from 'lucide-react';
import type { WithId, Project, Template } from '@/lib/definitions';
import { BulkTemplateForm } from '@/components/wabasimplify/bulk-template-form';
import { Skeleton } from '@/components/ui/skeleton';

function BulkActionsSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-32" />
            </div>
            <Skeleton className="h-4 w-96" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
            </div>
        </div>
    );
}


function BulkActionsClient({ projects, templates, projectIds }: { projects: WithId<Project>[], templates: WithId<Template>[], projectIds: string[] }) {
    const router = useRouter();

    const selectedProjects = useMemo(() => 
        projects.filter(p => projectIds.includes(p._id.toString())),
        [projects, projectIds]
    );

    if (projects.length === 0 || selectedProjects.length === 0) {
        return (
             <div className="flex flex-col gap-8">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Bulk Project Actions</h1>
                    <p className="text-muted-foreground">Perform actions on multiple projects at once.</p>
                </div>
                <p className="text-muted-foreground text-center py-8">No projects selected. Please go back to the dashboard and select projects for bulk actions.</p>
             </div>
        )
    }

    const sourceProject = selectedProjects[0];

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Bulk Project Actions</h1>
                <p className="text-muted-foreground">Perform actions on multiple projects at once.</p>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>Selected Projects ({selectedProjects.length})</CardTitle>
                    <CardDescription>Actions performed on this page will apply to all of the projects listed below.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {selectedProjects.map(p => (
                            <div key={p._id.toString()} className="flex items-center gap-3 p-2 border rounded-md bg-muted/50">
                                <Briefcase className="h-5 w-5 text-muted-foreground"/>
                                <div>
                                    <p className="font-semibold text-sm">{p.name}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
            <BulkTemplateForm
                sourceProjectName={sourceProject.name}
                targetProjects={selectedProjects}
                templates={templates}
            />
        </div>
    );
}

export default async function BulkPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined }}) {
    const projectIds = typeof searchParams?.projectIds === 'string' ? searchParams.projectIds.split(',') : [];
    
    // Fetch all projects to filter from, and templates from the first selected project
    const projects = await getProjects(undefined, 'whatsapp');
    const templates = projectIds.length > 0 ? await getTemplates(projectIds[0]) : [];

    return (
        <Suspense fallback={<BulkActionsSkeleton />}>
            <BulkActionsClient projects={projects} templates={templates} projectIds={projectIds} />
        </Suspense>
    );
}
