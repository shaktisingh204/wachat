
'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getProjects } from '@/app/actions';
import type { WithId, Project } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FacebookEmbeddedSignup } from '@/components/wabasimplify/facebook-embedded-signup';
import { CheckCircle, Facebook } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

function ManagePageButton({ project }: { project: WithId<Project> }) {
    const router = useRouter();
    
    const handleClick = () => {
        localStorage.setItem('activeProjectId', project._id.toString());
        localStorage.setItem('activeProjectName', project.name);
        router.push('/dashboard/facebook');
    };

    return <Button onClick={handleClick} size="sm">Manage</Button>;
}


function ConnectedPageCard({ project }: { project: WithId<Project> }) {
    return (
        <Card className="card-gradient card-gradient-blue">
            <CardHeader className="flex-row items-center gap-4">
                <Avatar className="h-12 w-12">
                     <AvatarFallback><Facebook className="h-6 w-6"/></AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>Page ID: {project.facebookPageId}</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                    <CheckCircle className="h-5 w-5" />
                    <p className="font-semibold">Connected</p>
                </div>
                <ManagePageButton project={project} />
            </CardContent>
        </Card>
    );
}

function ConnectProjectDialog({ unconnectedProjects, appId, configId, onSuccess }: { unconnectedProjects: WithId<Project>[], appId: string, configId: string, onSuccess: () => void}) {
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button>Connect a Project</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Connect a Project to Facebook</DialogTitle>
                    <DialogDescription>
                        Select one of your existing Wachat projects to connect it to a Facebook Page and Ad Account.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a project to connect..." />
                        </SelectTrigger>
                        <SelectContent>
                            {unconnectedProjects.map(p => (
                                <SelectItem key={p._id.toString()} value={p._id.toString()}>{p.name} (WABA: ...{p.wabaId?.slice(-4)})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FacebookEmbeddedSignup
                        appId={appId}
                        configId={configId}
                        projectId={selectedProjectId}
                        onSuccess={() => {
                            setIsOpen(false);
                            onSuccess();
                        }}
                    />
                </div>
            </DialogContent>
        </Dialog>
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

    const connectedProjects = projects.filter(p => !!p.facebookPageId && !!p.wabaId);
    const unconnectedProjects = projects.filter(p => !p.facebookPageId && !!p.wabaId);

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        Project Connections
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Connect your Wachat projects to Facebook to enable advertising and other features.
                    </p>
                </div>
                 <div>
                    {appId && configId && unconnectedProjects.length > 0 ? (
                        <ConnectProjectDialog
                            unconnectedProjects={unconnectedProjects}
                            appId={appId}
                            configId={configId}
                            onSuccess={fetchData}
                        />
                    ) : (
                         <p className="text-sm text-muted-foreground">All projects are connected.</p>
                    )}
                </div>
            </div>
            
            <div className="space-y-4">
                {connectedProjects.length > 0 ? (
                    connectedProjects.map(project => (
                        <ConnectedPageCard key={project._id.toString()} project={project} />
                    ))
                ) : (
                    <Card className="text-center py-12">
                         <CardContent>
                            <p className="text-muted-foreground">No projects have been connected to Facebook yet.</p>
                         </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
