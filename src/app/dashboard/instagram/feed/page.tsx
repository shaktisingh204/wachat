
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getInstagramMedia } from '@/app/actions/instagram.actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ThumbsUp, MessageSquare, ExternalLink, Video } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { WithId } from 'mongodb';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';

function FeedPageSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
                <Card key={i}>
                    <CardHeader>
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/4" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="aspect-square w-full" />
                    </CardContent>
                    <CardFooter>
                        <Skeleton className="h-8 w-full" />
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}

export default function InstagramFeedPage() {
    const [media, setMedia] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            startTransition(async () => {
                const { media: fetchedMedia, error: fetchError } = await getInstagramMedia(storedProjectId);
                if (fetchError) {
                    setError(fetchError);
                } else {
                    setMedia(fetchedMedia || []);
                }
            });
        } else {
            setError("No project selected.");
        }
    }, []);

    if (isLoading) {
        return <FeedPageSkeleton />;
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Loading Feed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {media.map(item => (
                <Card key={item.id} className="flex flex-col">
                    <CardHeader>
                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}</p>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <div className="relative aspect-square mb-2">
                             {item.media_type === 'VIDEO' ? (
                                <div className="w-full h-full bg-black rounded-md flex items-center justify-center">
                                    <video src={item.media_url} className="w-full h-full object-cover" controls={false} />
                                </div>
                            ) : (
                                <Image src={item.media_url} alt={item.caption || 'Instagram Post'} layout="fill" objectFit="cover" className="rounded-md" />
                            )}
                        </div>
                        <p className="text-sm line-clamp-3">{item.caption}</p>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center text-sm text-muted-foreground">
                        <div className="flex gap-4">
                            <span className="flex items-center gap-1"><ThumbsUp className="h-4 w-4"/> {item.like_count}</span>
                            <span className="flex items-center gap-1"><MessageSquare className="h-4 w-4"/> {item.comments_count}</span>
                        </div>
                         <Button variant="ghost" size="icon" asChild>
                            <Link href={item.permalink} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4"/>
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}

