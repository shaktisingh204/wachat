
'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Search, Compass, Users, Newspaper, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import Link from 'next/link';
import { discoverInstagramAccount } from '@/app/actions/instagram.actions';

const StatCard = ({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        </CardContent>
    </Card>
);

const DiscoveryResultSkeleton = () => (
    <div className="space-y-6 mt-6">
        <Card><CardHeader><div className="flex items-center gap-4"><Skeleton className="h-16 w-16 rounded-full" /><div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32" /></div></div></CardHeader></Card>
        <div className="grid md:grid-cols-2 gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        <Card><CardHeader><CardTitle>Recent Media</CardTitle></CardHeader><CardContent className="grid md:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="aspect-square" />)}</CardContent></Card>
    </div>
);

export default function InstagramDiscoveryPage() {
    const [username, setUsername] = useState('nike');
    const [discoveredData, setDiscoveredData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();

    const handleSearch = () => {
        if (!username.trim()) return;
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (!storedProjectId) {
            setError("No active project selected. Please select a project from the connections page.");
            return;
        }

        startTransition(async () => {
            setError(null);
            setDiscoveredData(null);
            const result = await discoverInstagramAccount(username, storedProjectId);
            if (result.error) {
                setError(result.error);
            } else {
                setDiscoveredData(result.account);
            }
        });
    };
    
    // Initial search on load
    useState(() => {
        handleSearch();
    });

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Compass className="h-8 w-8"/>
                    Instagram Discovery
                </h1>
                <p className="text-muted-foreground mt-2">
                   Analyze public metrics and recent media from other Instagram Business accounts.
                </p>
            </div>

            <Card>
                <CardContent className="p-4 flex gap-2">
                    <Input
                        placeholder="Enter Instagram username (e.g., nike)"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={isLoading}>
                        <Search className="mr-2 h-4 w-4"/>
                        Analyze
                    </Button>
                </CardContent>
            </Card>

            {isLoading && <DiscoveryResultSkeleton />}

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {discoveredData && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16">
                                    <AvatarImage src={discoveredData.profile_picture_url} alt={discoveredData.name} />
                                    <AvatarFallback>{discoveredData.name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <CardTitle className="text-2xl">{discoveredData.name}</CardTitle>
                                    <Button variant="link" asChild className="p-0 h-auto">
                                        <a href={`https://instagram.com/${username}`} target="_blank" rel="noopener noreferrer">
                                            @{username} <ExternalLink className="ml-2 h-4 w-4" />
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-4">
                        <StatCard title="Followers" value={discoveredData.followers_count || 0} icon={Users} />
                        <StatCard title="Media Count" value={discoveredData.media_count || 0} icon={Newspaper} />
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Media</CardTitle>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(discoveredData.media?.data || []).map((item: any) => (
                                <Link key={item.id} href={item.permalink || '#'} target="_blank" rel="noopener noreferrer" className="block relative aspect-square group">
                                    <Image src={item.media_url} alt={item.caption || 'Post'} layout="fill" objectFit="cover" className="rounded-md" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                                        <p className="text-white text-xs text-center line-clamp-4">{item.caption}</p>
                                    </div>
                                </Link>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
