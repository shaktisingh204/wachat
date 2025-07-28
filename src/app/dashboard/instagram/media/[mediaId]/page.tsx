
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { getInstagramMediaDetails } from '@/app/actions/instagram.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, ThumbsUp, MessageSquare, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { format } from 'date-fns';
import { InstagramViewCommentsDialog } from '@/components/wabasimplify/instagram-view-comments-dialog';

function PageSkeleton() {
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-8 w-32" />
            <div className="grid md:grid-cols-2 gap-8">
                <Skeleton className="aspect-square w-full" />
                <div className="space-y-4">
                    <Skeleton className="h-10 w-3/4" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-10 w-1/2" />
                </div>
            </div>
        </div>
    );
}

export default function MediaDetailsPage() {
    const params = useParams();
    const mediaId = params.mediaId as string;
    const [media, setMedia] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [viewingComments, setViewingComments] = useState(false);
    const [projectId, setProjectId] = useState<string | null>(null);

    const fetchData = () => {
        if (projectId && mediaId) {
            startTransition(async () => {
                const result = await getInstagramMediaDetails(projectId, mediaId);
                if (result.error) {
                    setError(result.error);
                } else {
                    setMedia(result.media);
                }
            });
        }
    }

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, mediaId]);

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Loading Media</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }
    
    if (!media) {
        return <PageSkeleton />;
    }

    return (
        <>
            <InstagramViewCommentsDialog 
                isOpen={viewingComments}
                onOpenChange={setViewingComments}
                media={media}
                projectId={projectId!}
                onActionComplete={fetchData}
            />
            <div className="max-w-4xl mx-auto space-y-6">
                <Button variant="ghost" asChild>
                    <Link href="/dashboard/instagram/feed">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Feed
                    </Link>
                </Button>
                <Card>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="relative aspect-square">
                            <Image src={media.media_url} alt={media.caption || 'Instagram Post'} layout="fill" objectFit="cover" className="rounded-l-lg" />
                        </div>
                        <div className="p-6 flex flex-col">
                            <CardHeader className="p-0">
                                <CardDescription>{format(new Date(media.timestamp), 'PPP p')}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0 py-4 flex-grow">
                                <p>{media.caption || 'No caption for this post.'}</p>
                            </CardContent>
                            <CardFooter className="p-0 flex flex-col items-start gap-4">
                                <div className="flex gap-6 text-lg">
                                    <div className="flex items-center gap-2">
                                        <ThumbsUp className="h-5 w-5 text-muted-foreground" />
                                        <span className="font-semibold">{media.like_count}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MessageSquare className="h-5 w-5 text-muted-foreground" />
                                        <span className="font-semibold">{media.comments_count}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={() => setViewingComments(true)}>View Comments</Button>
                                    <Button asChild variant="outline">
                                        <a href={media.permalink} target="_blank" rel="noopener noreferrer">
                                            View on Instagram
                                            <ExternalLink className="ml-2 h-4 w-4"/>
                                        </a>
                                    </Button>
                                </div>
                            </CardFooter>
                        </div>
                    </div>
                </Card>
            </div>
        </>
    );
}
