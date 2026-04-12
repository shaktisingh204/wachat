'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SeoProjectCard } from '@/components/wabasimplify/seo-project-card';
import { BarChart, ExternalLink, ArrowRight, TrendingUp } from 'lucide-react';
import { getSeoProjects } from '@/app/actions/seo.actions';
import { CreateSeoProjectDialog } from '@/components/wabasimplify/seo/create-project-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import type { SeoProject } from '@/lib/seo/definitions';

export default function SeoProjectsPage() {
    const [projects, setProjects] = useState<SeoProject[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getSeoProjects().then(data => {
            setProjects(data);
            setLoading(false);
        });
    }, []);

    if (loading) return <Skeleton className="h-[400px] w-full" />;

    return (
        <div className="flex flex-col gap-8 w-full">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <BarChart className="h-8 w-8 text-primary" />
                        SEO Projects
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Manage your website rankings, audits, and competitors.
                    </p>
                </div>
                <CreateSeoProjectDialog />
            </div>

            {projects.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                            <BarChart className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
                        <p className="text-muted-foreground mb-6 max-w-md">
                            Start tracking your website's SEO performance by creating your first project.
                        </p>
                        <CreateSeoProjectDialog />
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {projects.map((project: any) => (
                        <SeoProjectCard key={project._id} project={project} />
                    ))}
                </div>
            )}
        </div>
    );
}

