'use client';

import { useEffect, useState, useTransition, useCallback, useActionState } from 'react';
import { getPageReels, publishPageReel } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Film, Clock, ExternalLink, Upload, Eye, Hash } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';

function ReelsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
            </div>
        </div>
    );
}

export default function ReelsPage() {
    const [reels, setReels] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [showUpload, setShowUpload] = useState(false);

    const initialState = { message: undefined as string | undefined, error: undefined as string | undefined };
    const [uploadState, uploadAction] = useActionState(publishPageReel, initialState);

    const fetchReels = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const { reels: fetched, error: fetchError } = await getPageReels(projectId);
            if (fetchError) {
                setError(fetchError);
            } else if (fetched) {
                setReels(fetched);
            }
        });
    }, [projectId]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        fetchReels();
    }, [projectId, fetchReels]);

    useEffect(() => {
        if (uploadState?.message) {
            setShowUpload(false);
            fetchReels();
        }
    }, [uploadState, fetchReels]);

    if (isLoading && reels.length === 0) {
        return <ReelsPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Film className="h-8 w-8" />
                        Reels
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Manage Facebook Reels for your page.
                    </p>
                </div>
                <Button onClick={() => setShowUpload(!showUpload)}>
                    <Upload className="h-4 w-4 mr-2" /> Upload Reel
                </Button>
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
                    {/* Aggregate Stats */}
                    <div className="grid sm:grid-cols-2 gap-4">
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Hash className="h-4 w-4" /> Total Reels
                                </CardTitle>
                            </CardHeader>
                            <CardContent><p className="text-3xl font-bold">{reels.length}</p></CardContent>
                        </Card>
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Eye className="h-4 w-4" /> Total Views
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold">
                                    {reels.reduce((sum: number, r: any) => sum + (r.views || 0), 0).toLocaleString()}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Upload Section */}
                    {showUpload && (
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader><CardTitle>Upload New Reel</CardTitle></CardHeader>
                            <CardContent>
                                <form action={uploadAction} className="space-y-4">
                                    <input type="hidden" name="projectId" value={projectId} />
                                    {uploadState?.error && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>{uploadState.error}</AlertDescription>
                                        </Alert>
                                    )}
                                    {uploadState?.message && (
                                        <Alert>
                                            <AlertDescription>{uploadState.message}</AlertDescription>
                                        </Alert>
                                    )}
                                    <div className="space-y-2">
                                        <Label htmlFor="description">Description</Label>
                                        <Textarea id="description" name="description" rows={3} placeholder="Reel description..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="videoFile">Video File *</Label>
                                        <Input id="videoFile" name="videoFile" type="file" accept="video/*" required />
                                    </div>
                                    <Button type="submit">
                                        <Upload className="h-4 w-4 mr-2" /> Publish Reel
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    {/* Reels Grid */}
                    {reels.length > 0 ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {reels.map((reel: any) => (
                                <Card key={reel.id} className="card-gradient card-gradient-blue overflow-hidden flex flex-col">
                                    {reel.picture && (
                                        <div className="relative aspect-[9/16] max-h-64">
                                            <Image src={reel.picture} alt="Reel thumbnail" fill className="object-cover" data-ai-hint="reel video thumbnail" />
                                        </div>
                                    )}
                                    <CardContent className="p-4 space-y-2 flex-1">
                                        {reel.description && (
                                            <p className="text-sm line-clamp-2">{reel.description}</p>
                                        )}
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            {reel.created_time && (
                                                <span>{formatDistanceToNow(new Date(reel.created_time), { addSuffix: true })}</span>
                                            )}
                                            {reel.length && (
                                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {Math.round(reel.length)}s</span>
                                            )}
                                        </div>
                                        {reel.permalink_url && (
                                            <a href={reel.permalink_url} target="_blank" rel="noopener noreferrer"
                                                className="text-xs text-blue-400 hover:underline flex items-center gap-1 mt-1">
                                                <ExternalLink className="h-3 w-3" /> View on Facebook
                                            </a>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                            <CardContent>
                                <p className="text-lg font-semibold">No Reels Found</p>
                                <p>Upload your first reel to get started.</p>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
