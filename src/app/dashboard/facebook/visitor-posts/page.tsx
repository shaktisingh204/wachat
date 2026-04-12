'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { getVisitorPosts, getTaggedPosts } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Users, Tag, ThumbsUp, MessageCircle, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';

function VisitorPostsSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <Skeleton className="h-10 w-64" />
            <div className="space-y-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
        </div>
    );
}

function PostCard({ post }: { post: any }) {
    return (
        <Card className="card-gradient card-gradient-blue">
            <CardContent className="p-5">
                <div className="flex items-start gap-4">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={post.from?.picture?.data?.url} />
                        <AvatarFallback>{post.from?.name?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{post.from?.name || 'Unknown'}</p>
                            <div className="flex items-center gap-2">
                                {post.created_time && (
                                    <span className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(post.created_time), { addSuffix: true })}
                                    </span>
                                )}
                                {post.permalink_url && (
                                    <a href={post.permalink_url} target="_blank" rel="noopener noreferrer"
                                        className="text-muted-foreground hover:text-foreground">
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                )}
                            </div>
                        </div>
                        {post.message && (
                            <p className="text-sm text-muted-foreground">{post.message}</p>
                        )}
                        {post.full_picture && (
                            <div className="relative aspect-video max-h-48 overflow-hidden rounded-lg mt-2">
                                <Image src={post.full_picture} alt="Post image" fill className="object-cover" data-ai-hint="visitor post" />
                            </div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                            <span className="flex items-center gap-1">
                                <ThumbsUp className="h-3 w-3" /> {post.reactions?.summary?.total_count || 0}
                            </span>
                            <span className="flex items-center gap-1">
                                <MessageCircle className="h-3 w-3" /> {post.comments?.summary?.total_count || 0}
                            </span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function VisitorPostsPage() {
    const [visitorPosts, setVisitorPosts] = useState<any[]>([]);
    const [taggedPosts, setTaggedPosts] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);

    const fetchData = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const [visitorRes, taggedRes] = await Promise.all([
                getVisitorPosts(projectId),
                getTaggedPosts(projectId),
            ]);

            if (visitorRes.error) setError(visitorRes.error);
            else setVisitorPosts(visitorRes.posts || []);

            if (taggedRes.posts) setTaggedPosts(taggedRes.posts);
        });
    }, [projectId]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        fetchData();
    }, [projectId, fetchData]);

    if (isLoading && visitorPosts.length === 0 && taggedPosts.length === 0) {
        return <VisitorPostsSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Users className="h-8 w-8" />
                    Visitor & Tagged Posts
                </h1>
                <p className="text-muted-foreground mt-2">
                    Posts from visitors and posts your page is tagged in.
                </p>
            </div>

            {!projectId ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>Please select a project from the main dashboard.</AlertDescription>
                </Alert>
            ) : error ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : (
                <Tabs defaultValue="visitor">
                    <TabsList>
                        <TabsTrigger value="visitor">
                            <Users className="h-4 w-4 mr-1" /> Visitor Posts ({visitorPosts.length})
                        </TabsTrigger>
                        <TabsTrigger value="tagged">
                            <Tag className="h-4 w-4 mr-1" /> Tagged Posts ({taggedPosts.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="visitor">
                        {visitorPosts.length > 0 ? (
                            <div className="space-y-4 mt-4">
                                {visitorPosts.map((post: any) => (
                                    <PostCard key={post.id} post={post} />
                                ))}
                            </div>
                        ) : (
                            <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg mt-4">
                                <CardContent>
                                    <p className="text-lg font-semibold">No Visitor Posts</p>
                                    <p>No one has posted on your page yet.</p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="tagged">
                        {taggedPosts.length > 0 ? (
                            <div className="space-y-4 mt-4">
                                {taggedPosts.map((post: any) => (
                                    <PostCard key={post.id} post={post} />
                                ))}
                            </div>
                        ) : (
                            <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg mt-4">
                                <CardContent>
                                    <p className="text-lg font-semibold">No Tagged Posts</p>
                                    <p>Your page has not been tagged in any posts.</p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
