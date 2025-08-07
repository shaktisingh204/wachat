
'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { CreateTemplateForm } from '@/components/wabasimplify/create-template-form';
import { getProjectById } from '@/app/actions';
import type { WithId, Project } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Database, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

function BulkTemplatePageSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-96 w-full" />
        </div>
    );
}

function BulkTemplatePageContent() {
    const [projectIds, setProjectIds] = useState<string[]>([]);
    const [projects, setProjects] = useState<WithId<Project>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const storedProjectIds = JSON.parse(localStorage.getItem('bulkProjectIds') || '[]');
        setProjectIds(storedProjectIds);
        
        async function fetchProjects() {
            if (storedProjectIds.length > 0) {
                const fetchedProjects = await Promise.all(
                    storedProjectIds.map((id: string) => getProjectById(id))
                );
                setProjects(fetchedProjects.filter(Boolean) as WithId<Project>[]);
            }
            setIsLoading(false);
        }
        
        fetchProjects();
    }, []);

    if (isLoading) {
        return <BulkTemplatePageSkeleton />;
    }

    if (projectIds.length === 0) {
        return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Projects Selected</AlertTitle>
                <AlertDescription>
                    Go to the main dashboard to select projects for bulk template creation.
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                 <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard/bulk">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to Bulk Actions
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">Create Bulk Template</h1>
                <p className="text-muted-foreground">This template will be created for all {projects.length} selected projects.</p>
            </div>
             <div className="flex flex-wrap gap-2">
                {projects.map(p => (
                    <div key={p._id.toString()} className="flex items-center gap-2 p-2 text-xs border rounded-md bg-muted/50">
                        <Database className="h-4 w-4 text-muted-foreground"/>
                        <span className="font-semibold">{p.name}</span>
                    </div>
                ))}
            </div>
            <CreateTemplateForm 
                isBulkForm={true}
                bulkProjectIds={projectIds}
            />
        </div>
    );
}

export default function BulkTemplatePage() {
    return (
        <Suspense fallback={<BulkTemplatePageSkeleton />}>
            <BulkTemplatePageContent />
        </Suspense>
    );
}
