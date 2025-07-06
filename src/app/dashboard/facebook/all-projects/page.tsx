
'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getProjects } from '@/app/actions';
import type { WithId, Project } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FacebookEmbeddedSignup } from '@/components/wabasimplify/facebook-embedded-signup';
import { CheckCircle, Facebook, Wrench } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ManualFacebookSetupDialog } from '@/components/wabasimplify/manual-facebook-setup-dialog';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getInstagramAccountForPage } from '@/app/actions/facebook.actions';
import { WhatsAppIcon, InstagramIcon } from '@/components/wabasimplify/custom-sidebar-components';

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
    const [instagramId, setInstagramId] = useState<string | null>(null);
    const [checkingIg, setCheckingIg] = useState(true);

    useEffect(() => {
        getInstagramAccountForPage(project._id.toString()).then(result => {
            if (result.instagramId) {
                setInstagramId(result.instagramId);
            }
            setCheckingIg(false);
        });
    }, [project]);

    const handleClick = () => {
        localStorage.setItem('activeProjectId', project._id.toString());
        localStorage.setItem('activeProjectName', project.name);
        router.push('/dashboard/facebook');
    };

    return (
        <Card className={cn("flex flex-col card-gradient card-gradient-blue transition-transform hover:-translate-y-1")}>
            <CardHeader className="flex-row items-center gap-4">
                <Avatar className="h-12 w-12">
                     <AvatarFallback><Facebook className="h-6 w-6"/></AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>Page ID: {project.facebookPageId}</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="flex-grow">
                <Badge variant="secondary"><CheckCircle className="mr-1 h-3 w-3" /> Connected</Badge>
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    {checkingIg ? (
                        <Skeleton className="h-5 w-5 rounded-full" />
                    ) : instagramId ? (
                        <InstagramIcon className="h-5 w-5 text-instagram" />
                    ) : null}
                    {project.wabaId && <WhatsAppIcon className="h-5 w-5 text-green-500" />}
                </div>
                <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                        <a href={`https://facebook.com/${project.facebookPageId}`} target="_blank" rel="noopener noreferrer">View on Facebook</a>
                    </Button>
                    <Button onClick={handleClick} size="sm">Manage</Button>
                </div>
            </CardFooter>
        </Card>
    );
}

export default function AllFacebookPagesPage() {
    const [projects, setProjects] = useState<WithId<Project>[]>([]);
    const [isLoading, startLoading] = useTransition();

    const fetchData = () => {
        startLoading(async () => {
            const projectsData = await getProjects();
            setProjects(projectsData);
        });
    }

    useEffect(() => {
        fetchData();
    }, []);

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const configId = process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID;

    if (isLoading) {
        return <PageSkeleton />;
    }

    const connectedFacebookProjects = projects.filter(p => !!p.facebookPageId);

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    Facebook Page Connections
                </h1>
                <p className="text-muted-foreground mt-2">
                    Connect and manage your Facebook Pages. Each connected page is treated as a separate project.
                </p>
            </div>

            <Card className="card-gradient card-gradient-green">
                <CardHeader>
                    <CardTitle>Connect a New Page</CardTitle>
                    <CardDescription>
                        Use the secure pop-up for the fastest setup. If it fails, or if you need to use a System User token, use the Manual Setup.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                    {appId && configId ? (
                        <FacebookEmbeddedSignup
                            appId={appId}
                            configId={configId}
                            onSuccess={fetchData}
                        />
                    ) : (
                         <p className="text-sm text-destructive">Admin has not configured Facebook integration.</p>
                    )}
                    <ManualFacebookSetupDialog onSuccess={fetchData} />
                </CardContent>
                <CardFooter>
                     <p className="text-xs text-muted-foreground">
                        Note: The standard connection requires whitelisting your domain as a valid OAuth Redirect URI in your Facebook App settings. Manual setup avoids this requirement.
                    </p>
                </CardFooter>
            </Card>
            
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {connectedFacebookProjects.length > 0 ? (
                    connectedFacebookProjects.map(project => (
                        <ConnectedPageCard key={project._id.toString()} project={project} />
                    ))
                ) : (
                    <Card className="text-center py-12 md:col-span-2 xl:col-span-3">
                         <CardContent>
                            <p className="text-muted-foreground">No Facebook Pages have been connected yet.</p>
                         </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
