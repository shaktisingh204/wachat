
'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getProjects } from "@/lib/actions/user.actions.ts";
import type { WithId, Project } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ManualFacebookSetupDialog } from '@/components/wabasimplify/manual-facebook-setup-dialog';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { FacebookIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { CheckCircle, Wrench } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
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

    const fetchData = () => {
        startLoading(async () => {
            // Fetch both types to show everything on one page
            const { projects: waProjects } = await getProjects(undefined, 'whatsapp');
            const { projects: fbProjects } = await getProjects(undefined, 'facebook');
            
            const combined = [...waProjects, ...fbProjects];
            const unique = Array.from(new Map(combined.map(p => [p._id.toString(), p])).values());
            setProjects(unique);
        });
    }

    useEffect(() => {
        fetchData();
    }, []);

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;

    if (isLoading) {
        return <PageSkeleton />;
    }
    
    const connectedFacebookProjects = projects.filter(p => !!p.facebookPageId && !p.wabaId);
    const connectedWhatsAppProjects = projects.filter(p => !!p.wabaId);


    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    Meta Suite Connections
                </h1>
                <p className="text-muted-foreground mt-2">
                    Connect and manage your Facebook Pages and WhatsApp accounts.
                </p>
            </div>

            <Card className="card-gradient card-gradient-green">
                <CardHeader>
                    <CardTitle>Connect a New Facebook Page</CardTitle>
                    <CardDescription>
                        Use the secure pop-up to connect your Facebook account and select the pages you want to manage.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                    {appId ? (
                        <Link href="/api/auth/meta-suite/login" className="w-full sm:w-auto">
                            <Button size="lg" className="bg-[#1877F2] hover:bg-[#1877F2]/90 w-full">
                                <FacebookIcon className="mr-2 h-5 w-5" />
                                Connect with Facebook
                            </Button>
                        </Link>
                    ) : (
                         <p className="text-sm text-destructive">Admin has not configured the Facebook App ID.</p>
                    )}
                    <ManualFacebookSetupDialog onSuccess={fetchData} />
                </CardContent>
            </Card>

            <Separator />
            
            <h2 className="text-2xl font-semibold">Connected Pages</h2>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {connectedFacebookProjects.length > 0 ? (
                    connectedFacebookProjects.map(project => (
                        <ConnectedPageCard key={project._id.toString()} project={project} />
                    ))
                ) : (
                    <Card className="text-center py-12 md:col-span-2 xl:col-span-3">
                         <CardContent>
                            <p className="text-muted-foreground">No standalone Facebook Pages have been connected yet.</p>
                         </CardContent>
                    </Card>
                )}
            </div>
            <Separator />

             <h2 className="text-2xl font-semibold">WhatsApp Projects</h2>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {connectedWhatsAppProjects.length > 0 ? (
                    connectedWhatsAppProjects.map(project => (
                         <Card key={project._id.toString()}>
                            <CardHeader>
                                <CardTitle>{project.name}</CardTitle>
                                <CardDescription>WABA ID: {project.wabaId}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {project.adAccountId && project.facebookPageId ? (
                                    <Badge><CheckCircle className="mr-2 h-4 w-4"/>Ad Account Connected</Badge>
                                ) : (
                                     <p className="text-sm text-muted-foreground">Ad account not linked.</p>
                                )}
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <Card className="text-center py-12 md:col-span-2 xl:col-span-3">
                         <CardContent>
                            <p className="text-muted-foreground">No WhatsApp projects found. <Link href="/dashboard/setup" className="text-primary hover:underline">Connect one now.</Link></p>
                         </CardContent>
                    </Card>
                )}
            </div>

        </div>
    );
}
