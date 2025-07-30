
'use client';

import { Suspense, useEffect, useState, useTransition, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreateTemplateForm } from '@/components/wabasimplify/create-template-form';
import { getProjectById } from '@/app/actions';
import type { WithId, Project } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, Database } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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
    const searchParams = useSearchParams();
    const [projects, setProjects] = useState<WithId<Project>[]>([]);
    const [isLoading, startTransition] = useTransition();

    const projectIds = searchParams.get('projectIds')?.split(',') || [];

     const fetchData = useCallback(async () => {
        if (projectIds.length > 0) {
            const fetchedProjects = await Promise.all(
                projectIds.map(id => getProjectById(id))
            );
            setProjects(fetchedProjects.filter(Boolean) as WithId<Project>[]);
        }
    }, [projectIds]);

    useEffect(() => {
        startTransition(() => {
            fetchData();
        });
    }, [fetchData]);

    if (isLoading) {
        return <BulkTemplatePageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                 <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href={`/dashboard/bulk?projectIds=${projectIds.join(',')}`}><ChevronLeft className="mr-2 h-4 w-4" />Back to Bulk Actions</Link>
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
