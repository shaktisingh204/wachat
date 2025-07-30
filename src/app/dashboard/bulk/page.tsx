
import { Suspense } from 'react';
import { getProjects } from '@/app/actions';
import { getTemplates } from '@/app/actions/template.actions';
import type { WithId, Project, Template } from '@/lib/definitions';
import { BulkActionsClient } from '@/components/wabasimplify/bulk-actions-client';
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

export default async function BulkPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined }}) {
    const projectIds = typeof searchParams?.projectIds === 'string' ? searchParams.projectIds.split(',') : [];
    
    // Fetch all necessary data on the server
    const allProjects = await getProjects(undefined, 'whatsapp');
    const sourceProject = allProjects.find(p => p._id.toString() === projectIds[0]);
    const templates = sourceProject ? await getTemplates(sourceProject._id.toString()) : [];
    const selectedProjects = allProjects.filter(p => projectIds.includes(p._id.toString()));

    return (
        <Suspense fallback={<BulkActionsSkeleton />}>
            <BulkActionsClient 
                sourceProjectName={sourceProject?.name || ''}
                allProjects={allProjects} 
                initialTemplates={templates} 
                initialSelectedProjects={selectedProjects} 
            />
        </Suspense>
    );
}
