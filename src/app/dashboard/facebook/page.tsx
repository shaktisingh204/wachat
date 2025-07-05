'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getPageDetails } from '@/app/actions/facebook.actions';
import type { FacebookPageDetails } from '@/lib/definitions';
import { AlertCircle, Users, ThumbsUp, Newspaper, Megaphone, Settings, MessageSquare, Wrench } from 'lucide-react';
import Image from 'next/image';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const StatCard = ({ title, value, icon: Icon, gradientClass }: { title: string, value: string | number, icon: React.ElementType, gradientClass?: string }) => (
    <Card className={cn("card-gradient", gradientClass)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        </CardContent>
    </Card>
);

const features = [
    { href: '/dashboard/facebook/create-post', title: 'Create Post', description: 'Publish content to your page.', icon: Newspaper },
    { href: '/dashboard/facebook/posts', title: 'Manage Posts', description: 'View and manage recent posts.', icon: Newspaper },
    { href: '/dashboard/facebook/ads', title: 'Ads Manager', description: 'Create and monitor campaigns.', icon: Megaphone },
    { href: '/dashboard/facebook/messages', title: 'Live Chat', description: 'Engage with customers on Messenger.', icon: MessageSquare },
    { href: '/dashboard/facebook/pages', title: 'All Pages', description: 'View all connected pages.', icon: Newspaper },
    { href: '/dashboard/facebook/audiences', title: 'Audiences', description: 'Manage custom audiences.', icon: Users },
    { href: '/dashboard/facebook/all/projects', title: 'Project Connections', description: 'Connect your projects to Facebook.', icon: Wrench },
    { href: '/dashboard/facebook/settings', title: 'Settings', description: 'View your connected account IDs.', icon: Settings },
];

function DashboardSkeleton() {
    return (
        <div className="space-y-8">
            <Skeleton className="h-8 w-1/3" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2"><Skeleton className="h-48" /></div>
                <div><Skeleton className="h-48" /></div>
            </div>
        </div>
    );
}


export default function FacebookDashboardPage() {
    const [pageDetails, setPageDetails] = useState<FacebookPageDetails | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        if (projectId) {
            startLoading(async () => {
                const { page, error: fetchError } = await getPageDetails(projectId);
                if (fetchError) {
                    setError(fetchError);
                } else if (page) {
                    setPageDetails(page);
                }
            });
        }
    }, [projectId]);
    
    if (isLoading) return <DashboardSkeleton />;

    if (!projectId) {
         return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard to view its Facebook overview.
                </AlertDescription>
            </Alert>
         )
    }

     if (error) {
         return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Could not load Page Details</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
         )
    }

    if (!pageDetails) {
        return <p>No page details available.</p>;
    }


    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                    <AvatarFallback>{pageDetails.name.charAt(0)}</AvatarFallback>
                    {pageDetails.picture?.data?.url && <Image src={pageDetails.picture.data.url} alt={pageDetails.name} width={64} height={64} className="rounded-full" data-ai-hint="logo company"/>}
                </Avatar>
                <div>
                    <h1 className="text-3xl font-bold font-headline">{pageDetails.name}</h1>
                    <p className="text-muted-foreground">{pageDetails.category}</p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Followers" value={pageDetails.followers_count || 0} icon={Users} gradientClass="card-gradient-blue" />
                <StatCard title="Likes" value={pageDetails.fan_count || 0} icon={ThumbsUp} gradientClass="card-gradient-green" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader><CardTitle>About</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">{pageDetails.about || 'No description provided.'}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Quick Links</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        {features.map(feature => (
                             <Button key={feature.href} asChild variant="ghost" className="w-full justify-start">
                                <Link href={feature.href}>
                                    <feature.icon className="mr-2 h-4 w-4" />
                                    {feature.title}
                                </Link>
                            </Button>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
