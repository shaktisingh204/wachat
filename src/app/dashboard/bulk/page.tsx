
'use client';

import { Suspense, useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { getProjectById } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Database } from 'lucide-react';
import Link from 'next/link';
import type { WithId, Project } from '@/lib/definitions';

function BulkPageContent() {
    const searchParams = useSearchParams();
    const [projects, setProjects] = useState<WithId<Project>[]>([]);
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        const projectIdsParam = searchParams.get('projectIds');
        if (projectIdsParam) {
            const projectIds = projectIdsParam.split(',');
            startTransition(async () => {
                const fetchedProjects = await Promise.all(
                    projectIds.map(id => getProjectById(id))
                );
                setProjects(fetchedProjects.filter(Boolean) as WithId<Project>[]);
            });
        }
    }, [searchParams]);

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
                    <CardTitle>Selected Projects</CardTitle>
                    <CardDescription>
                        Data for the selected projects will be displayed and processed here.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    ) : projects.length > 0 ? (
                        <ul className="space-y-2">
                            {projects.map(p => (
                                <li key={p._id.toString()} className="flex items-center gap-3 p-2 border rounded-md">
                                    <Database className="h-5 w-5 text-muted-foreground"/>
                                    <div>
                                        <p className="font-semibold">{p.name}</p>
                                        <p className="text-xs text-muted-foreground font-mono">{p._id.toString()}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">No projects selected.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function BulkPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <BulkPageContent />
        </Suspense>
    )
}
