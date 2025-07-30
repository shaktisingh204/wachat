
'use client';

import { Suspense, useEffect, useState, useTransition, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { getProjectById, getTemplates } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Database, FileText } from 'lucide-react';
import Link from 'next/link';
import type { WithId, Project, Template } from '@/lib/definitions';
import { BulkTemplateForm } from '@/components/wabasimplify/bulk-template-form';

function BulkPageSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
    );
}

function BulkPageContent() {
    const searchParams = useSearchParams();
    const [projects, setProjects] = useState<WithId<Project>[]>([]);
    const [sourceTemplates, setSourceTemplates] = useState<WithId<Template>[]>([]);
    const [isLoading, startTransition] = useTransition();

    const projectIdsParam = searchParams.get('projectIds');
    const projectIds = projectIdsParam?.split(',') || [];

    const fetchData = useCallback(async () => {
        if (projectIds.length > 0) {
            const fetchedProjects = await Promise.all(
                projectIds.map(id => getProjectById(id))
            );
            const validProjects = fetchedProjects.filter(Boolean) as WithId<Project>[];
            setProjects(validProjects);

            if (validProjects.length > 0) {
                const templatesData = await getTemplates(validProjects[0]._id.toString());
                setSourceTemplates(templatesData);
            }
        }
    }, [projectIds]);

    useEffect(() => {
        startTransition(() => {
            fetchData();
        });
    }, [fetchData]);


    if (isLoading) {
        return <BulkPageSkeleton />;
    }

    const sourceProject = projects[0];

    return (
        <div className="flex flex-col gap-8">
            <div>
                 <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" />Back to Projects</Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">Bulk Project Actions</h1>
                <p className="text-muted-foreground">Perform actions on multiple projects at once.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Selected Projects ({projects.length})</CardTitle>
                    <CardDescription>
                        Actions performed on this page will apply to all of the projects listed below.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {projects.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {projects.map(p => (
                                <div key={p._id.toString()} className="flex items-center gap-3 p-2 border rounded-md bg-muted/50">
                                    <Database className="h-5 w-5 text-muted-foreground"/>
                                    <div>
                                        <p className="font-semibold text-sm">{p.name}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">No projects selected.</p>
                    )}
                </CardContent>
            </Card>

            {sourceProject && (
                <BulkTemplateForm
                    sourceProjectName={sourceProject.name}
                    targetProjects={projects}
                    templates={sourceTemplates}
                />
            )}
        </div>
    );
}

export default function BulkPage() {
    return (
        <Suspense fallback={<BulkPageSkeleton />}>
            <BulkPageContent />
        </Suspense>
    )
}
