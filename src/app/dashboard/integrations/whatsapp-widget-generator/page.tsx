
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getProjectById } from '@/app/actions/index.ts';
import type { WithId, Project } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Eye, BarChart, Users } from 'lucide-react';
import { WhatsAppWidgetGenerator } from '@/components/wabasimplify/whatsapp-widget-generator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-80 w-full" />
        </div>
    )
}

function StatCard({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.ElementType }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value.toLocaleString()}</div>
            </CardContent>
        </Card>
    );
}

export default function WhatsappWidgetGeneratorPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();

    const fetchProjectData = async () => {
         const storedProjectId = localStorage.getItem('activeProjectId');
         if (storedProjectId) {
            const data = await getProjectById(storedProjectId);
            setProject(data);
        }
    };

    useEffect(() => {
        startLoadingTransition(() => {
            fetchProjectData();
        });
    }, []);

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!project) {
        return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard to configure integrations.
                </AlertDescription>
            </Alert>
        );
    }
    
    const stats = project.widgetSettings?.stats || { loads: 0, opens: 0, clicks: 0 };

    return (
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2"><BarChart className="h-5 w-5"/>Widget Analytics</CardTitle>
                         <Button onClick={() => fetchProjectData()} variant="outline" size="sm">
                            <RefreshCw className="mr-2 h-4 w-4"/>
                            Refresh Stats
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-4">
                    <StatCard title="Widget Loads" value={stats.loads} icon={Eye} />
                    <StatCard title="Chat Opens" value={stats.opens} icon={Users} />
                    <StatCard title="Clicks to WhatsApp" value={stats.clicks} icon={BarChart} />
                </CardContent>
            </Card>

            <WhatsAppWidgetGenerator project={project} />
        </div>
    )
}
