
'use client';

import { Suspense, useEffect, useState, useTransition, useMemo, useCallback } from 'react';
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

function BulkPageContent() {
    const [allProjects, setAllProjects] = useState<WithId<Project>[]>([]);
    const [templates, setTemplates] = useState<WithId<Template>[]>([]);
    const [selectedProjects, setSelectedProjects] = useState<WithId<Project>[]>([]);
    const [isLoading, startTransition] = useTransition();

    const fetchInitialData = useCallback(() => {
        startTransition(async () => {
            const storedProjectIds = JSON.parse(localStorage.getItem('bulkProjectIds') || '[]');
            const { projects: fetchedProjects } = await getProjects(undefined, 'whatsapp');
            setAllProjects(fetchedProjects);
            
            if (storedProjectIds.length > 0) {
                const filteredProjects = fetchedProjects.filter(p => storedProjectIds.includes(p._id.toString()));
                setSelectedProjects(filteredProjects);
                
                const sourceProject = filteredProjects[0];
                if(sourceProject) {
                    const fetchedTemplates = await getTemplates(sourceProject._id.toString());
                    setTemplates(fetchedTemplates);
                }
            }
        });
    }, []);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    if (isLoading) {
        return <BulkActionsSkeleton />;
    }

    return (
        <BulkActionsClient 
            sourceProjectName={selectedProjects[0]?.name || ''}
            allProjects={allProjects} 
            initialTemplates={templates} 
            initialSelectedProjects={selectedProjects} 
        />
    );
}


export default function BulkPage() {
    return (
        <Suspense fallback={<BulkActionsSkeleton />}>
            <BulkPageContent />
        </Suspense>
    );
}
