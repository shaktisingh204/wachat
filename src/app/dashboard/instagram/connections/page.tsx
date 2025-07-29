
'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getProjects } from '@/app/actions';
import { getInstagramAccountForPage } from '@/app/actions/instagram.actions';
import type { WithId, Project } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { InstagramIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { ArrowRight, Wrench } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
            </div>
        </div>
    );
}

function InstagramAccountCard({ project, onSelect }: { project: WithId<Project> & { instagramProfile?: any }, onSelect: () => void }) {
    const { instagramProfile } = project;

    return (
        <Card className="flex flex-col">
            <CardHeader className="flex-row items-center gap-4">
                <Avatar className="h-12 w-12">
                    <AvatarImage src={instagramProfile?.profile_picture_url} alt={instagramProfile?.username} />
                    <AvatarFallback><InstagramIcon className="h-6 w-6"/></AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle>{instagramProfile?.username || project.name}</CardTitle>
                    <CardDescription>IG User ID: {instagramProfile?.id}</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">Followers: {instagramProfile?.followers_count?.toLocaleString() || 'N/A'}</p>
                 <p className="text-sm text-muted-foreground">Media Count: {instagramProfile?.media_count?.toLocaleString() || 'N/A'}</p>
            </CardContent>
            <CardFooter>
                 <Button onClick={onSelect} className="w-full">
                    Manage Account <ArrowRight className="ml-2 h-4 w-4"/>
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function InstagramConnectionsPage() {
    const [projects, setProjects] = useState<(WithId<Project> & { instagramProfile?: any })[]>([]);
    const [isLoading, startLoading] = useTransition();
    const router = useRouter();

    useEffect(() => {
        startLoading(async () => {
            const facebookProjects = await getProjects(undefined, 'facebook');
            const projectsWithIg = await Promise.all(
                facebookProjects.map(async (p) => {
                    const { instagramAccount } = await getInstagramAccountForPage(p._id.toString());
                    return instagramAccount ? { ...p, instagramProfile: instagramAccount } : null;
                })
            );
            setProjects(projectsWithIg.filter(Boolean) as any);
        });
    }, []);

    const handleSelectProject = (project: WithId<Project>) => {
        localStorage.setItem('activeProjectId', project._id.toString());
        localStorage.setItem('activeProjectName', project.instagramProfile?.username || project.name);
        router.push('/dashboard/instagram');
    }

    if (isLoading) {
        return <PageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <InstagramIcon className="h-8 w-8"/>
                    Instagram Connections
                </h1>
                <p className="text-muted-foreground mt-2">
                    Select an Instagram Business Account to manage.
                </p>
            </div>

            {projects.length > 0 ? (
                 <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(p => (
                        <InstagramAccountCard key={p._id.toString()} project={p} onSelect={() => handleSelectProject(p)} />
                    ))}
                </div>
            ) : (
                <Card className="text-center py-12">
                     <CardContent className="space-y-4">
                        <p className="text-lg font-semibold">No Instagram Accounts Found</p>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            We couldn't find any Instagram Business Accounts linked to your connected Facebook Pages. Please ensure they are properly connected in your Meta Business Suite.
                        </p>
                        <Button asChild variant="outline">
                            <Link href="/dashboard/instagram/setup">
                                <Wrench className="mr-2 h-4 w-4"/>
                                Go to Setup
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
