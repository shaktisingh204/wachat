
'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getScheduledPosts, publishScheduledPost } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Newspaper, Edit, Trash2, Send, LoaderCircle, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { FacebookPost } from '@/lib/definitions';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { UpdatePostDialog } from '@/components/wabasimplify/update-post-dialog';
import { DeletePostButton } from '@/components/wabasimplify/delete-post-button';
import { useToast } from '@/hooks/use-toast';

function ScheduledPostCard({ post, projectId, onActionComplete }: { post: FacebookPost, projectId: string, onActionComplete: () => void }) {
    const [isUpdateOpen, setIsUpdateOpen] = useState(false);
    const [isPublishing, startPublishing] = useTransition();
    const { toast } = useToast();

    const onPublishNow = () => {
        startPublishing(async () => {
            const result = await publishScheduledPost(post.id, projectId);
            if (result.success) {
                toast({ title: 'Success', description: 'Post is being published now.' });
                onActionComplete();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }

    return (
        <>
            <UpdatePostDialog
                isOpen={isUpdateOpen}
                onOpenChange={setIsUpdateOpen}
                post={post}
                projectId={projectId}
                onPostUpdated={onActionComplete}
            />
            <Card className="flex flex-col">
                {post.full_picture && (
                    <div className="relative aspect-video">
                        <Image src={post.full_picture} alt={post.message?.substring(0, 50) || 'Facebook Post'} layout="fill" objectFit="cover" className="rounded-t-lg" data-ai-hint="social media post"/>
                    </div>
                )}
                <CardHeader>
                    <CardDescription className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Scheduled for {post.scheduled_publish_time ? format(new Date(post.scheduled_publish_time * 1000), 'PPP p') : 'Unknown time'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-4">
                        {post.message || <span className="italic">This post has no text content.</span>}
                    </p>
                </CardContent>
                <CardFooter className="flex justify-end items-center gap-1 p-2 pt-0 border-t mt-2">
                    <Button variant="secondary" size="sm" className="h-7" onClick={onPublishNow} disabled={isPublishing}>
                        {isPublishing ? <LoaderCircle className="h-3 w-3 mr-1 animate-spin"/> : <Send className="h-3 w-3 mr-1"/>}
                        Publish Now
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsUpdateOpen(true)}><Edit className="h-3 w-3" /></Button>
                    <DeletePostButton postId={post.id} projectId={projectId} onPostDeleted={onActionComplete} />
                </CardFooter>
            </Card>
        </>
    );
}

function ScheduledPostsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-72 w-full" />)}
            </div>
        </div>
    );
}

export default function ScheduledPostsPage() {
    const [posts, setPosts] = useState<FacebookPost[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [actionCounter, setActionCounter] = useState(0);

    const fetchPosts = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const { posts: fetchedPosts, error: fetchError } = await getScheduledPosts(projectId);
            if (fetchError) {
                setError(fetchError);
            } else if (fetchedPosts) {
                setPosts(fetchedPosts);
            }
        });
    }, [projectId]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        fetchPosts();
    }, [projectId, fetchPosts, actionCounter]);

    const handleActionComplete = () => {
        setActionCounter(prev => prev + 1);
    };

    if (isLoading && posts.length === 0) {
        return <ScheduledPostsPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Calendar className="h-8 w-8" />
                    Scheduled Posts
                </h1>
                <p className="text-muted-foreground mt-2">
                    Manage posts that are scheduled to be published in the future.
                </p>
            </div>
            
            {!projectId ? (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard to view its scheduled posts.
                    </AlertDescription>
                </Alert>
            ) : error ? (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Could not fetch scheduled posts</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : posts.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {posts.map(post => <ScheduledPostCard key={post.id} post={post} projectId={projectId} onActionComplete={handleActionComplete} />)}
                </div>
            ) : (
                 <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                    <CardContent>
                        <p className="text-lg font-semibold">No Scheduled Posts</p>
                        <p>You have no posts scheduled for the future.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
