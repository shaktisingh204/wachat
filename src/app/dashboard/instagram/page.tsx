
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getInstagramAccountForPage } from '@/app/actions/instagram.actions';
import { AlertCircle, Users, Clapperboard, Newspaper, MessageSquare } from 'lucide-react';
import type { WithId } from 'mongodb';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';

const StatCard = ({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.ElementType }) => (
    <Card className="card-gradient card-gradient-purple">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        </CardContent>
    </Card>
);

function DashboardSkeleton() {
    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
            </div>
        </div>
    );
}

export default function InstagramDashboardPage() {
    const [account, setAccount] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (isClient) {
            const storedProjectId = localStorage.getItem('activeProjectId');
            if (storedProjectId) {
                startLoading(async () => {
                    const { instagramAccount, error: fetchError } = await getInstagramAccountForPage(storedProjectId);
                    if (fetchError) {
                        setError(fetchError);
                    } else {
                        setAccount(instagramAccount);
                    }
                });
            } else {
                setError("No project selected.");
            }
        }
    }, [isClient]);

    if (isLoading) {
        return <DashboardSkeleton />;
    }
    
    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Loading Account</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    if (!account) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-primary">
                    <AvatarImage src={account.profile_picture_url} alt={account.username} />
                    <AvatarFallback>{account.username.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                    <h1 className="text-3xl font-bold font-headline">@{account.username}</h1>
                    <p className="text-muted-foreground capitalize">{account.account_type?.toLowerCase()}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard title="Followers" value={account.followers_count} icon={Users} />
                <StatCard title="Media Count" value={account.media_count} icon={Newspaper} />
                <StatCard title="Engagement" value="N/A" icon={Clapperboard} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                 <Card>
                    <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
                    <CardContent>
                        <ul className="space-y-4">
                            <li className="flex items-center gap-3"><Link href="/dashboard/instagram/feed" className="flex-1 text-primary hover:underline">New post published</Link><span className="text-xs text-muted-foreground">2 hours ago</span></li>
                            <li className="flex items-center gap-3"><Link href="/dashboard/instagram/messages" className="flex-1 text-primary hover:underline">New message from @user</Link><span className="text-xs text-muted-foreground">5 hours ago</span></li>
                            <li className="flex items-center gap-3"><Link href="/dashboard/instagram/stories" className="flex-1 text-primary hover:underline">Story mentioned you</Link><span className="text-xs text-muted-foreground">1 day ago</span></li>
                        </ul>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Quick Links</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                        <Link href="/dashboard/instagram/feed"><Card className="p-4 text-center hover:bg-accent"><Newspaper className="mx-auto h-8 w-8 text-primary mb-2"/>Feed</Card></Link>
                        <Link href="/dashboard/instagram/stories"><Card className="p-4 text-center hover:bg-accent"><Clapperboard className="mx-auto h-8 w-8 text-primary mb-2"/>Stories</Card></Link>
                        <Link href="/dashboard/instagram/reels"><Card className="p-4 text-center hover:bg-accent"><Video className="mx-auto h-8 w-8 text-primary mb-2"/>Reels</Card></Link>
                        <Link href="/dashboard/instagram/messages"><Card className="p-4 text-center hover:bg-accent"><MessageSquare className="mx-auto h-8 w-8 text-primary mb-2"/>Messages</Card></Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
