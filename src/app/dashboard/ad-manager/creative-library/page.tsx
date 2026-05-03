'use client';

import * as React from 'react';
import { Image as ImageIcon, Upload, AlertCircle, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdManager } from '@/context/ad-manager-context';
import { useToast } from '@/hooks/use-toast';
import {
    listAdImages, listAdVideos, uploadAdImage, uploadAdVideo,
} from '@/app/actions/ad-manager.actions';

export default function CreativeLibraryPage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [images, setImages] = React.useState<any[]>([]);
    const [videos, setVideos] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    const load = React.useCallback(async () => {
        if (!activeAccount) return;
        setLoading(true);
        const [i, v] = await Promise.all([
            listAdImages(activeAccount.account_id),
            listAdVideos(activeAccount.account_id),
        ]);
        setImages(i.data || []);
        setVideos(v.data || []);
        setLoading(false);
    }, [activeAccount]);

    React.useEffect(() => { load(); }, [load]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
        const file = e.target.files?.[0];
        if (!file || !activeAccount) return;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('adAccountId', activeAccount.account_id);
        const res = type === 'image' ? await uploadAdImage(fd) : await uploadAdVideo(fd);
        if (res.error) toast({ title: 'Upload failed', description: res.error, variant: 'destructive' });
        else { toast({ title: 'Uploaded' }); load(); }
    };

    if (!activeAccount) {
        return (
            <div>
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to view your creative library.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <ImageIcon className="h-6 w-6" /> Creative library
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        All images and videos uploaded to this ad account.
                    </p>
                </div>
            </div>

            <Tabs defaultValue="images">
                <TabsList>
                    <TabsTrigger value="images">Images ({images.length})</TabsTrigger>
                    <TabsTrigger value="videos">Videos ({videos.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="images">
                    <div className="mb-3">
                        <label className="inline-flex">
                            <Button variant="outline" asChild>
                                <span>
                                    <Upload className="h-4 w-4 mr-1" /> Upload image
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handleUpload(e, 'image')}
                                    />
                                </span>
                            </Button>
                        </label>
                    </div>
                    {loading ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <Skeleton key={i} className="aspect-square rounded-lg" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {images.map((img) => (
                                <Card key={img.hash} className="overflow-hidden group relative">
                                    <div
                                        className="aspect-square bg-muted cursor-pointer"
                                        onClick={() => window.open(img.url, '_blank')}
                                        title="Click to preview"
                                    >
                                        <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                            <ExternalLink className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                    <CardContent className="p-2">
                                        <div className="flex items-center justify-between gap-1">
                                            <div className="min-w-0">
                                                <div className="text-xs font-medium truncate">{img.name}</div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    {img.width}×{img.height}
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-600"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setImages((prev) => prev.filter((i) => i.hash !== img.hash));
                                                    toast({ title: 'Image removed from library' });
                                                }}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="videos">
                    <div className="mb-3">
                        <label className="inline-flex">
                            <Button variant="outline" asChild>
                                <span>
                                    <Upload className="h-4 w-4 mr-1" /> Upload video
                                    <input
                                        type="file"
                                        accept="video/*"
                                        className="hidden"
                                        onChange={(e) => handleUpload(e, 'video')}
                                    />
                                </span>
                            </Button>
                        </label>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {videos.map((v) => (
                            <Card key={v.id} className="overflow-hidden group relative">
                                <div
                                    className="aspect-video bg-muted relative cursor-pointer"
                                    onClick={() => v.source ? window.open(v.source, '_blank') : v.picture && window.open(v.picture, '_blank')}
                                    title="Click to preview"
                                >
                                    {v.picture && <img src={v.picture} alt="" className="w-full h-full object-cover" />}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                        <ExternalLink className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                                <CardContent className="p-2">
                                    <div className="flex items-center justify-between gap-1">
                                        <div className="text-xs font-medium truncate">{v.title || 'Untitled'}</div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-600"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setVideos((prev) => prev.filter((vid) => vid.id !== v.id));
                                                toast({ title: 'Video removed from library' });
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
