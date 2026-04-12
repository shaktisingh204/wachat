'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { getPageStories, publishPhotoStory } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CircleDot, Upload, Image as ImageIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';

function StoriesPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
            </div>
        </div>
    );
}

export default function StoriesPage() {
    const [stories, setStories] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [isPublishing, startPublishTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [photoUrl, setPhotoUrl] = useState('');

    const fetchStories = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const { stories: fetched, error: fetchError } = await getPageStories(projectId);
            if (fetchError) {
                setError(fetchError);
            } else if (fetched) {
                setStories(fetched);
            }
        });
    }, [projectId]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        fetchStories();
    }, [projectId, fetchStories]);

    const handlePublish = () => {
        if (!projectId || !photoUrl.trim()) return;
        startPublishTransition(async () => {
            const result = await publishPhotoStory(projectId, photoUrl.trim());
            if (result.error) {
                setError(result.error);
            } else {
                setPhotoUrl('');
                fetchStories();
            }
        });
    };

    if (isLoading && stories.length === 0) {
        return <StoriesPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <CircleDot className="h-8 w-8" />
                    Stories
                </h1>
                <p className="text-muted-foreground mt-2">
                    View and publish Facebook Page stories.
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
                <>
                    {/* Publish Section */}
                    <Card className="card-gradient card-gradient-blue">
                        <CardHeader><CardTitle className="text-base">Publish Photo Story</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex gap-3 items-end">
                                <div className="flex-1 space-y-2">
                                    <Label htmlFor="photoUrl">Photo URL</Label>
                                    <Input
                                        id="photoUrl"
                                        value={photoUrl}
                                        onChange={(e) => setPhotoUrl(e.target.value)}
                                        placeholder="https://example.com/photo.jpg"
                                    />
                                </div>
                                <Button onClick={handlePublish} disabled={isPublishing || !photoUrl.trim()}>
                                    <Upload className="h-4 w-4 mr-2" /> Publish
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stories Grid */}
                    {stories.length > 0 ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {stories.map((story: any) => (
                                <Card key={story.id} className="card-gradient card-gradient-blue overflow-hidden">
                                    {story.url && (
                                        <div className="relative aspect-[9/16] max-h-64">
                                            <Image src={story.url} alt="Story" fill className="object-cover" data-ai-hint="facebook story" />
                                        </div>
                                    )}
                                    <CardContent className="p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Badge variant="secondary" className="text-xs">
                                                {story.media_type || 'photo'}
                                            </Badge>
                                            {story.status && (
                                                <Badge variant={story.status === 'PUBLISHED' ? 'default' : 'secondary'}
                                                    className={story.status === 'PUBLISHED' ? 'bg-green-600 hover:bg-green-700' : ''}>
                                                    {story.status}
                                                </Badge>
                                            )}
                                        </div>
                                        {story.created_time && (
                                            <p className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(story.created_time), { addSuffix: true })}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                            <CardContent>
                                <p className="text-lg font-semibold">No Active Stories</p>
                                <p>Publish a photo story to get started.</p>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
