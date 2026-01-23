'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getProjects } from "@/app/actions";
import type { WithId, Project } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CheckCircle, Wrench, ArrowRight } from 'lucide-react';
import { ManualFacebookSetupDialog } from '@/components/wabasimplify/manual-facebook-setup-dialog';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { FacebookIcon } from '@/components/wabasimplify/custom-sidebar-components';

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
            </div>
        </div>
    );
}

function ConnectedPageCard({ project }: { project: WithId<Project> }) {
    const router = useRouter();

    const handleClick = () => {
        localStorage.setItem('activeProjectId', project._id.toString());
        localStorage.setItem('activeProjectName', project.name);
        router.push('/dashboard/facebook');
    };

    return (
        <Card className={cn("flex flex-col card-gradient card-gradient-blue transition-transform hover:-translate-y-1")}>
            <CardHeader className="flex-row items-center gap-4">
                <Avatar className="h-12 w-12">
                     <AvatarImage src={`https://graph.facebook.com/${project.facebookPageId}/picture?type=large`} />
                     <AvatarFallback><FacebookIcon className="h-6 w-6"/></AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>Page ID: {project.facebookPageId}</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="flex-grow">
                <Badge variant="secondary"><CheckCircle className="mr-1 h-3 w-3" /> Connected</Badge>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button asChild variant="outline" size="sm">
                    <a href={`https://facebook.com/${project.facebookPageId}`} target="_blank" rel="noopener noreferrer">View on Facebook</a>
                </Button>
                <Button onClick={handleClick} size="sm">Manage</Button>
            </CardFooter>
        </Card>
    );
}

export default function AllFacebookPagesPage() {
    const [projects, setProjects] = useState<WithId<Project>[]>([]);
    const [isLoading, startLoading] = useTransition();

    const fetchData = useCallback(() => {
        startLoading(async () => {
            try {
                const result = await getProjects(undefined, 'facebook');
                if (result && Array.isArray(result.projects)) {
                    setProjects(result.projects);
                } else {
                    console.warn("[AllFacebookPagesPage] getProjects did not return the expected structure. Got:", result);
                    setProjects([]);
                }
            } catch (error) {
                console.error("[AllFacebookPagesPage] Failed to fetch projects:", error);
                setProjects([]);
            }
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;

    if (isLoading) {
        return <PageSkeleton />;
    }
    
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    Meta Suite Connections
                </h1>
                <p className="text-muted-foreground mt-2">
                    Connect and manage your Facebook Pages.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Connected Pages</CardTitle>
                    <CardDescription>A list of all your connected Facebook Pages.</CardDescription>
                </CardHeader>
                <CardContent>
                    {projects.length > 0 ? (
                        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {projects.map(project => (
                                <ConnectedPageCard key={project._id.toString()} project={project} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No Facebook Pages have been connected yet.</p>
                    )}
                </CardContent>
                <CardFooter className="justify-between items-center gap-4">
                     {appId ? (
                        <Link href={`/api/auth/meta-suite/login`}>
                            <Button size="lg" className="bg-[#1877F2] hover:bg-[#1877F2]/90 w-full">
                                <FacebookIcon className="mr-2 h-5 w-5" />
                                Connect New Page
                            </Button>
                        </Link>
                    ) : (
                         <p className="text-sm text-destructive">Admin has not configured the Facebook App ID.</p>
                    )}
                    <ManualFacebookSetupDialog onSuccess={fetchData} />
                </CardFooter>
            </Card>
        </div>
    );
}
