'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
        <div className="flex flex-col gap-8 w-full p-6">
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
                        <Card key={project._id} className="group hover:border-primary/50 transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="font-bold text-xl truncate">
                                    {project.domain}
                                </CardTitle>
                                <Link href={`/dashboard/seo/${project._id}`} passHref>
                                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4 my-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-muted-foreground">Health Score</span>
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${project.healthScore >= 90 ? 'bg-green-500' : project.healthScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                    style={{ width: `${project.healthScore || 0}%` }}
                                                />
                                            </div>
                                            <span className="font-bold">{project.healthScore || 'N/A'}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-muted-foreground">Last Audit</span>
                                        <span className="font-medium text-sm">
                                            {project.lastAuditDate ? formatDistanceToNow(new Date(project.lastAuditDate), { addSuffix: true }) : 'Never'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 mt-4">
                                    <span className="text-xs text-muted-foreground">Competitors</span>
                                    <div className="flex flex-wrap gap-2">
                                        {project.competitors && project.competitors.length > 0 ? (
                                            project.competitors.slice(0, 3).map((comp: string) => (
                                                <Badge key={comp} variant="outline" className="text-xs font-normal">
                                                    {comp}
                                                </Badge>
                                            ))
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">None added</span>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <Link href={`/dashboard/seo/${project._id}`} className="w-full">
                                        <Button className="w-full" variant="secondary">
                                            View Dashboard
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

