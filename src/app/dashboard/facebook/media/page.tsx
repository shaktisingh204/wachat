'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { getPageAlbums, getPagePhotos, getPageVideos, getVideoPlaylists } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Image as ImageIcon, FolderOpen, Video, ListVideo, ThumbsUp, MessageCircle, Eye, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';

function MediaPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <Skeleton className="h-10 w-96" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
            </div>
        </div>
    );
}

export default function MediaPage() {
    const [photos, setPhotos] = useState<any[]>([]);
    const [albums, setAlbums] = useState<any[]>([]);
    const [videos, setVideos] = useState<any[]>([]);
    const [playlists, setPlaylists] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);

    const fetchAll = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const [photosRes, albumsRes, videosRes, playlistsRes] = await Promise.all([
                getPagePhotos(projectId),
                getPageAlbums(projectId),
                getPageVideos(projectId),
                getVideoPlaylists(projectId),
            ]);

            if (photosRes.error) setError(photosRes.error);
            else setPhotos(photosRes.photos || []);

            if (albumsRes.albums) setAlbums(albumsRes.albums);
            if (videosRes.videos) setVideos(videosRes.videos);
            if (playlistsRes.playlists) setPlaylists(playlistsRes.playlists);
        });
    }, [projectId]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        fetchAll();
    }, [projectId, fetchAll]);

    if (isLoading && photos.length === 0 && albums.length === 0 && videos.length === 0) {
        return <MediaPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <ImageIcon className="h-8 w-8" />
                    Media Library
                </h1>
                <p className="text-muted-foreground mt-2">
                    Photos, albums, videos, and playlists from your Facebook Page.
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
                <Tabs defaultValue="photos">
                    <TabsList>
                        <TabsTrigger value="photos"><ImageIcon className="h-4 w-4 mr-1" /> Photos ({photos.length})</TabsTrigger>
                        <TabsTrigger value="albums"><FolderOpen className="h-4 w-4 mr-1" /> Albums ({albums.length})</TabsTrigger>
                        <TabsTrigger value="videos"><Video className="h-4 w-4 mr-1" /> Videos ({videos.length})</TabsTrigger>
                        <TabsTrigger value="playlists"><ListVideo className="h-4 w-4 mr-1" /> Playlists ({playlists.length})</TabsTrigger>
                    </TabsList>

                    {/* Photos Tab */}
                    <TabsContent value="photos">
                        {photos.length === 0 ? (
                            <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                                <CardContent><p>No photos found.</p></CardContent>
                            </Card>
                        ) : (
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                                {photos.map((photo: any) => (
                                    <Card key={photo.id} className="card-gradient card-gradient-blue overflow-hidden">
                                        {photo.source && (
                                            <div className="relative aspect-video">
                                                <Image src={photo.source} alt={photo.name || 'Photo'} fill className="object-cover" data-ai-hint="facebook photo" />
                                            </div>
                                        )}
                                        <CardContent className="p-3">
                                            {photo.name && <p className="text-sm font-medium line-clamp-1 mb-1">{photo.name}</p>}
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {photo.likes?.summary?.total_count || 0}</span>
                                                <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {photo.comments?.summary?.total_count || 0}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Albums Tab */}
                    <TabsContent value="albums">
                        {albums.length === 0 ? (
                            <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                                <CardContent><p>No albums found.</p></CardContent>
                            </Card>
                        ) : (
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                                {albums.map((album: any) => (
                                    <Card key={album.id} className="card-gradient card-gradient-blue overflow-hidden">
                                        {album.cover_photo?.source && (
                                            <div className="relative aspect-video">
                                                <Image src={album.cover_photo.source} alt={album.name || 'Album'} fill className="object-cover" data-ai-hint="album cover" />
                                            </div>
                                        )}
                                        <CardContent className="p-3 space-y-1">
                                            <p className="font-medium text-sm">{album.name}</p>
                                            <p className="text-xs text-muted-foreground">{album.count || 0} photos</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Videos Tab */}
                    <TabsContent value="videos">
                        {videos.length === 0 ? (
                            <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                                <CardContent><p>No videos found.</p></CardContent>
                            </Card>
                        ) : (
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                                {videos.map((video: any) => (
                                    <Card key={video.id} className="card-gradient card-gradient-blue overflow-hidden">
                                        {video.picture && (
                                            <div className="relative aspect-video">
                                                <Image src={video.picture} alt={video.title || 'Video'} fill className="object-cover" data-ai-hint="video thumbnail" />
                                            </div>
                                        )}
                                        <CardContent className="p-3 space-y-1">
                                            <p className="font-medium text-sm line-clamp-1">{video.title || 'Untitled Video'}</p>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                {video.length && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {Math.round(video.length)}s</span>}
                                                {video.views !== undefined && <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {video.views} views</span>}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Playlists Tab */}
                    <TabsContent value="playlists">
                        {playlists.length === 0 ? (
                            <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                                <CardContent><p>No playlists found.</p></CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3 mt-4">
                                {playlists.map((pl: any) => (
                                    <Card key={pl.id} className="card-gradient card-gradient-blue">
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-sm">{pl.title || 'Untitled Playlist'}</p>
                                                {pl.description && <p className="text-xs text-muted-foreground line-clamp-1">{pl.description}</p>}
                                            </div>
                                            <span className="text-xs text-muted-foreground">{pl.videos_count || 0} videos</span>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
