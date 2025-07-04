
'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getFacebookPosts } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Link as LinkIcon, Newspaper, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { FacebookPost } from '@/lib/definitions';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';

function PostCard({ post }: { post: FacebookPost }) {
    return (
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
                <Button asChild variant="outline" size="sm">
                    <a href={post.permalink_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-3 w-3" /> View Post
                    </a>
                </Button>
            </CardFooter>
        </Card>
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

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        if (projectId) {
            startTransition(async () => {
                const { posts: fetchedPosts, error: fetchError } = await getFacebookPosts(projectId);
                if (fetchError) {
                    setError(fetchError);
                } else if (fetchedPosts) {
                    setPosts(fetchedPosts);
                }
            });
        }
    }, [projectId]);
    
    if (isLoading && posts.length === 0) {
        return <PostsPageSkeleton />;
    }
    
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
                    {posts.map(post => <PostCard key={post.id} post={post} />)}
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
