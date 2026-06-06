'use client';

import * as React from 'react';
import {
    Card,
    CardBody,
    EmptyState,
    IconButton,
    SegmentedControl,
    Skeleton,
    useToast,
} from '@/components/sabcrm/20ui';
import { ExternalLink, Image as ImageIcon, Trash2, Video as VideoIcon } from 'lucide-react';

import { SabFileToFileButton } from '@/components/sabfiles';
import { AmBreadcrumb, AmErrorAlert, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useAdManager } from '@/context/ad-manager-context';
import {
    listAdImages, listAdVideos, uploadAdImage, uploadAdVideo,
} from '@/app/actions/ad-manager.actions';

export default function CreativeLibraryPage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [images, setImages] = React.useState<any[]>([]);
    const [videos, setVideos] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState<'images' | 'videos'>('images');
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const load = React.useCallback(async () => {
        if (!activeAccount) return;
        setLoading(true);
        try {
            const [i, v] = await Promise.all([
                listAdImages(activeAccount.account_id),
                listAdVideos(activeAccount.account_id),
            ]);
            setImages(i.data || []);
            setVideos(v.data || []);
        } catch (err) {
            toast.error('Failed to load creatives');
        } finally {
            setLoading(false);
        }
    }, [activeAccount, toast]);

    React.useEffect(() => {
        if (mounted) {
            load();
        }
    }, [load, mounted]);

    const handleUpload = async (file: File, type: 'image' | 'video') => {
        if (!file || !activeAccount) return;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('adAccountId', activeAccount.account_id);

        try {
            const res = type === 'image' ? await uploadAdImage(fd) : await uploadAdVideo(fd);
            if (res.error) {
                toast({ title: 'Upload failed', description: res.error, tone: 'danger' });
            } else {
                toast.success('Uploaded successfully');
                load();
            }
        } catch (err) {
            toast({ title: 'Upload failed', description: 'An unexpected error occurred.', tone: 'danger' });
        }
    };

    if (!mounted) {
        return (
            <div className="space-y-6">
                <AmBreadcrumb page="Creative library" />
                <AmHeader
                    title="Creative library"
                    description="All images and videos uploaded to this ad account."
                />
                <div className="flex gap-4">
                    <Skeleton height={40} width={96} radius="var(--st-radius)" />
                    <Skeleton height={40} width={96} radius="var(--st-radius)" />
                </div>
            </div>
        );
    }

    if (!activeAccount) {
        return (
            <div className="space-y-6">
                <AmBreadcrumb page="Creative library" />
                <AmErrorAlert message="Pick an ad account to view your creative library." />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Creative library" />
            <AmHeader
                title="Creative library"
                description="All images and videos uploaded to this ad account."
            />

            <SegmentedControl
                aria-label="Creative type"
                value={activeTab}
                onChange={(v) => setActiveTab(v as 'images' | 'videos')}
                items={[
                    { value: 'images', label: `Images (${images.length})`, icon: ImageIcon },
                    { value: 'videos', label: `Videos (${videos.length})`, icon: VideoIcon },
                ]}
            />

            {activeTab === 'images' && (
                <div className="space-y-3">
                    <div>
                        <SabFileToFileButton
                            accept="image"
                            onPickFile={(file) => handleUpload(file, 'image')}
                            onError={(e) => toast.error(e.message || 'Upload failed')}
                        >
                            Upload image
                        </SabFileToFileButton>
                    </div>
                    {loading ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <Skeleton key={i} className="aspect-square" radius="var(--st-radius)" />
                            ))}
                        </div>
                    ) : images.length === 0 ? (
                        <EmptyState
                            icon={ImageIcon}
                            title="No images yet"
                            description="Upload an image to start building your creative library."
                        />
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {images.map((img) => (
                                <Card key={img.hash} padding="none" className="overflow-hidden group relative">
                                    <button
                                        type="button"
                                        className="block w-full aspect-square bg-[var(--st-bg-secondary)] relative cursor-pointer"
                                        onClick={() => window.open(img.url, '_blank')}
                                        aria-label={`Preview ${img.name}`}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                                        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                            <ExternalLink className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                                        </span>
                                    </button>
                                    <CardBody className="p-2">
                                        <div className="flex items-center justify-between gap-1">
                                            <div className="min-w-0">
                                                <div className="text-xs font-medium truncate text-[var(--st-text)]">{img.name}</div>
                                                <div className="text-[10px] text-[var(--st-text-secondary)]">
                                                    {img.width}x{img.height}
                                                </div>
                                            </div>
                                            <IconButton
                                                label={`Remove ${img.name}`}
                                                icon={Trash2}
                                                variant="ghost"
                                                size="sm"
                                                className="shrink-0"
                                                onClick={() => {
                                                    setImages((prev) => prev.filter((i) => i.hash !== img.hash));
                                                    toast.success('Image removed from library');
                                                }}
                                            />
                                        </div>
                                    </CardBody>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'videos' && (
                <div className="space-y-3">
                    <div>
                        <SabFileToFileButton
                            accept="video"
                            onPickFile={(file) => handleUpload(file, 'video')}
                            onError={(e) => toast.error(e.message || 'Upload failed')}
                        >
                            Upload video
                        </SabFileToFileButton>
                    </div>
                    {loading ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <Skeleton key={i} className="aspect-video" radius="var(--st-radius)" />
                            ))}
                        </div>
                    ) : videos.length === 0 ? (
                        <EmptyState
                            icon={VideoIcon}
                            title="No videos yet"
                            description="Upload a video to start building your creative library."
                        />
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {videos.map((v) => {
                                const preview = v.source || v.picture;
                                return (
                                    <Card key={v.id} padding="none" className="overflow-hidden group relative">
                                        <button
                                            type="button"
                                            className="block w-full aspect-video bg-[var(--st-bg-secondary)] relative cursor-pointer"
                                            onClick={() => preview && window.open(preview, '_blank')}
                                            aria-label={`Preview ${v.title || 'video'}`}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            {v.picture && <img src={v.picture} alt="" className="w-full h-full object-cover" />}
                                            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                <ExternalLink className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                                            </span>
                                        </button>
                                        <CardBody className="p-2">
                                            <div className="flex items-center justify-between gap-1">
                                                <div className="text-xs font-medium truncate text-[var(--st-text)]">{v.title || 'Untitled'}</div>
                                                <IconButton
                                                    label={`Remove ${v.title || 'video'}`}
                                                    icon={Trash2}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="shrink-0"
                                                    onClick={() => {
                                                        setVideos((prev) => prev.filter((vid) => vid.id !== v.id));
                                                        toast.success('Video removed from library');
                                                    }}
                                                />
                                            </div>
                                        </CardBody>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
