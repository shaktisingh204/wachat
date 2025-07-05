
'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getFacebookPosts } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Link as LinkIcon, Newspaper, ExternalLink, Edit, Trash2, Video, Image as ImageIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { FacebookPost } from '@/lib/definitions';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { UpdatePostDialog } from '@/components/wabasimplify/update-post-dialog';
import { DeletePostButton } from '@/components/wabasimplify/delete-post-button';
import { AddThumbnailDialog } from '@/components/wabasimplify/add-thumbnail-dialog';
import { CrosspostDialog } from '@/components/wabasimplify/crosspost-dialog';

function PostCard({ post, projectId, onActionComplete }: { post: FacebookPost, projectId: string, onActionComplete: () => void }) {
    const [isUpdateOpen, setIsUpdateOpen] = useState(false);
    const [isThumbnailOpen, setIsThumbnailOpen] = useState(false);
    const [isCrosspostOpen, setIsCrosspostOpen] = useState(false);
    const isVideo = !!post.object_id;

    return (
        <>
            <UpdatePostDialog
                isOpen={isUpdateOpen}
                onOpenChange={setIsUpdateOpen}
                post={post}
                projectId={projectId}
                onPostUpdated={onActionComplete}
            />
            {isVideo && post.object_id && (
                <>
                <AddThumbnailDialog
                    isOpen={isThumbnailOpen}
                    onOpenChange={setIsThumbnailOpen}
                    videoId={post.object_id}
                    projectId={projectId}
                    onSuccess={onActionComplete}
                />
                <CrosspostDialog
                    isOpen={isCrosspostOpen}
                    onOpenChange={setIsCrosspostOpen}
                    postId={post.id}
                    projectId={projectId}
                    onSuccess={onActionComplete}
                />
                </>
            )}
            <Card className="flex flex-col">
                {post.full_picture && (
                    <div className="relative aspect-video">
                        <Image src={post.full_picture} alt={post.message?.substring(0, 50) || 'Facebook Post'} layout="fill" objectFit="cover" className="rounded-t-lg" data-ai-hint="social media post"/>
                    </div>
                )}
                <CardContent className="p-4 flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-4">
                        {post.message || <span className="italic">This post has no text content.</span>}
                    </p>
                </CardContent>
                <CardFooter className="flex justify-between items-center text-xs text-muted-foreground p-4 pt-0">
                    <span>{formatDistanceToNow(new Date(post.created_time), { addSuffix: true })}</span>
                    <div className="flex items-center gap-1">
                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsUpdateOpen(true)}><Edit className="h-3 w-3" /></Button>
                         <DeletePostButton postId={post.id} projectId={projectId} onPostDeleted={onActionComplete} />
                         {isVideo && (
                            <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsThumbnailOpen(true)}><ImageIcon className="h-3 w-3"/></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsCrosspostOpen(true)}><Video className="h-3 w-3"/></Button>
                            </>
                         )}
                         <Button asChild variant="outline" size="sm">
                            <a href={post.permalink_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-2 h-3 w-3" /> View
                            </a>
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </>
    );
}


function PostsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-72 w-full" />)}
            </div>
        </div>
    );
}

export default function PagePostsPage() {
    const [posts, setPosts] = useState<FacebookPost[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [actionCounter, setActionCounter] = useState(0); // Used to trigger re-fetch

    const fetchPosts = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const { posts: fetchedPosts, error: fetchError } = await getFacebookPosts(projectId);
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
    
    if (isLoading && posts.length === 0) {
        return <PostsPageSkeleton />;
    }

    const handleActionComplete = () => {
        setActionCounter(prev => prev + 1);
    };
    
    return (
        <div className="flex flex-col gap-8">
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Newspaper className="h-8 w-8"/>
                    Page Posts
                </h1>
                <p className="text-muted-foreground mt-2">
                    A feed of the most recent posts from your connected Facebook Page.
                </p>
            </div>
            
            {!projectId ? (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard to view its posts.
                    </AlertDescription>
                </Alert>
            ) : error ? (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Could not fetch posts</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : posts.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {posts.map(post => <PostCard key={post.id} post={post} projectId={projectId} onActionComplete={handleActionComplete} />)}
                </div>
            ) : (
                 <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                    <CardContent>
                        <p className="text-lg font-semibold">No Posts Found</p>
                        <p>We couldn't find any recent posts for the connected page.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
