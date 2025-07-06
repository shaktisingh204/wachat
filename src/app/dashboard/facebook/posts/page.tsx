
'use client';

import { useEffect, useState, useTransition, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getFacebookPosts, handleLikeObject } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Newspaper, ExternalLink, Edit, ThumbsUp, MessageCircle, Share2, Video, CornerUpRight, Image as ImageIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { FacebookPost } from '@/lib/definitions';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { UpdatePostDialog } from '@/components/wabasimplify/update-post-dialog';
import { DeletePostButton } from '@/components/wabasimplify/delete-post-button';
import { AddThumbnailDialog } from '@/components/wabasimplify/add-thumbnail-dialog';
import { CrosspostDialog } from '@/components/wabasimplify/crosspost-dialog';
import { ViewCommentsDialog } from '@/components/wabasimplify/view-comments-dialog';
import { useToast } from '@/hooks/use-toast';

function PostCard({ post, projectId, onActionComplete }: { post: FacebookPost, projectId: string, onActionComplete: () => void }) {
    const [isUpdateOpen, setIsUpdateOpen] = useState(false);
    const [isThumbnailOpen, setIsThumbnailOpen] = useState(false);
    const [isCrosspostOpen, setIsCrosspostOpen] = useState(false);
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [isLiking, startLikingTransition] = useTransition();
    const { toast } = useToast();

    const isVideo = !!post.object_id;
    
    const reactionCount = post.reactions?.summary?.total_count || 0;
    const commentCount = post.comments?.summary?.total_count || 0;
    const shareCount = post.shares?.count || 0;
    const imageUrl = post.full_picture;

    const onLike = () => {
        startLikingTransition(async () => {
            const result = await handleLikeObject(post.id, projectId);
            if (!result.success) {
                toast({ title: "Error", description: "Could not like this post.", variant: "destructive" });
            } else {
                 toast({ title: "Liked!", description: "You have liked this post." });
                 onActionComplete();
            }
        });
    };


    return (
        <>
            <UpdatePostDialog
                isOpen={isUpdateOpen}
                onOpenChange={setIsUpdateOpen}
                post={post}
                projectId={projectId}
                onPostUpdated={onActionComplete}
            />
            {isCommentsOpen && (
                <ViewCommentsDialog
                    isOpen={isCommentsOpen}
                    onOpenChange={setIsCommentsOpen}
                    post={post}
                    projectId={projectId}
                    onActionComplete={onActionComplete}
                />
            )}
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
            <Card className="flex flex-col justify-between card-gradient card-gradient-blue h-full">
                <div>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-semibold line-clamp-2">
                           {post.message || (isVideo ? 'Video Post' : 'Media Post')}
                        </CardTitle>
                        <CardDescription>
                             {formatDistanceToNow(new Date(post.created_time), { addSuffix: true })}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 pb-4">
                        {imageUrl && (
                            <a href={post.permalink_url} target="_blank" rel="noopener noreferrer" className="block relative aspect-video mt-2 overflow-hidden rounded-lg">
                                <Image src={imageUrl} alt="Post image" layout="fill" objectFit="cover" data-ai-hint="social media post"/>
                            </a>
                        )}
                    </CardContent>
                </div>
                <CardFooter className="flex justify-between items-center border-t pt-3 pb-3 mt-auto">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5 cursor-pointer hover:text-foreground" onClick={() => setIsCommentsOpen(true)}>
                            <MessageCircle className="h-4 w-4" /> {commentCount}
                        </span>
                        <span className="flex items-center gap-1.5 cursor-pointer hover:text-foreground" onClick={onLike}>
                            <ThumbsUp className="h-4 w-4" /> {reactionCount}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Share2 className="h-4 w-4" /> {shareCount}
                        </span>
                    </div>
                     <div className="flex items-center">
                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsUpdateOpen(true)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                        <DeletePostButton postId={post.id} projectId={projectId} onPostDeleted={onActionComplete} />
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
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 grid-rows-[masonry]">
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
