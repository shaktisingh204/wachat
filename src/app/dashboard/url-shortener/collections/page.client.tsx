'use client';

import { useState, useEffect, useTransition } from 'react';
import {
    PageHeader, ZoruPageTitle, ZoruPageHeading, ZoruPageDescription,
    Card, Button, Badge, cn, useZoruToast, Skeleton
} from '@/components/zoruui';
import { FolderOpen, Link2 } from 'lucide-react';
import {
    getCollections, addLinkToCollection, removeLinkFromCollection,
    type UrlCollectionDoc
} from '@/app/actions/url-collections.actions';
import { getShortUrls } from '@/app/actions/url-shortener.actions';
import type { WithId } from 'mongodb';
import type { ShortUrl } from '@/lib/definitions';
import { LinkItemActions } from './_components/LinkItemActions';

export default function CollectionsPage() {
    const [collections, setCollections] = useState<UrlCollectionDoc[]>([]);
    const [urls, setUrls] = useState<WithId<ShortUrl>[]>([]);
    const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useZoruToast();

    const loadData = () => {
        startTransition(async () => {
            try {
                const [cols, urlData] = await Promise.all([
                    getCollections(),
                    getShortUrls(),
                ]);
                setCollections(cols || []);
                setUrls(urlData?.urls || []);
            } catch (error) {
                toast({ title: 'Error', description: 'Failed to load collections or URLs', variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        });
    };

    useEffect(() => { loadData(); }, []);

    const selectedCol = collections.find((c) => c._id === selectedCollection);

    const assignedIds = new Set(selectedCol?.linkIds ?? []);

    const handleToggle = (linkId: string) => {
        if (!selectedCollection) return;
        startTransition(async () => {
            try {
                if (assignedIds.has(linkId)) {
                    await removeLinkFromCollection(selectedCollection, linkId);
                } else {
                    await addLinkToCollection(selectedCollection, linkId);
                }
                loadData();
            } catch (error) {
                toast({ title: 'Error', description: 'Failed to update collection', variant: 'destructive' });
            }
        });
    };

    return (
        <div className="flex flex-col gap-6 p-6">
            <PageHeader>
                <ZoruPageHeading>
                    <ZoruPageTitle>Collections</ZoruPageTitle>
                </ZoruPageHeading>
                <ZoruPageDescription>
                    Organise your short links into named folders. Select a collection, then toggle links to add or remove them.
                </ZoruPageDescription>
            </PageHeader>

            <div className="flex gap-4 min-h-[400px]">
                <div className="w-56 flex-shrink-0 space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zoru-ink-muted/60 mb-2 px-1">Your Collections</p>
                    {isLoading ? (
                        <div className="space-y-2 mt-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : collections.length === 0 ? (
                        <Card className="p-4 text-center text-[12px] text-zoru-ink-muted mt-2">
                            No collections yet.<br />
                            <a href="/dashboard/url-shortener" className="text-amber-400 hover:underline">Create one on the Links page</a>
                        </Card>
                    ) : (
                        collections.map((col) => (
                            <button
                                key={col._id}
                                onClick={() => setSelectedCollection(col._id)}
                                className={cn(
                                    'w-full flex items-center gap-2 px-3 py-2 text-[12.5px] rounded-lg border transition-colors',
                                    selectedCollection === col._id
                                        ? 'border-amber-400/50 bg-zinc-800 text-zoru-ink'
                                        : 'border-transparent hover:bg-zinc-900 text-zoru-ink-muted'
                                )}
                            >
                                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                                <span className="truncate flex-1 text-left">{col.name}</span>
                                <Badge variant="secondary" className="text-[10px]">{col.linkIds?.length || 0}</Badge>
                            </button>
                        ))
                    )}
                </div>

                <div className="flex-1">
                    {!selectedCollection ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-16 text-zoru-ink-muted">
                            <FolderOpen className="h-10 w-10 mb-3 opacity-40" />
                            <p className="text-sm">Select a collection to manage its links</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-[11px] font-medium uppercase tracking-wider text-zoru-ink-muted/60 mb-3 px-1">
                                Links — click to toggle assignment to <span style={{ color: selectedCol?.color }}>{selectedCol?.name}</span>
                            </p>
                            {isLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-14 w-full" />
                                    <Skeleton className="h-14 w-full" />
                                    <Skeleton className="h-14 w-full" />
                                </div>
                            ) : urls.length === 0 ? (
                                <Card className="p-6 text-center text-[12px] text-zoru-ink-muted">No links yet.</Card>
                            ) : (
                                urls.map((url) => {
                                    const id = url._id.toString();
                                    const inCollection = assignedIds.has(id);
                                    return (
                                        <div
                                            key={id}
                                            className={cn(
                                                'group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
                                                inCollection
                                                    ? 'border-amber-400/40 bg-amber-400/5'
                                                    : 'border-zoru-border hover:border-zoru-border/80 hover:bg-zinc-900'
                                            )}
                                        >
                                            <button 
                                                onClick={() => handleToggle(id)}
                                                disabled={isPending}
                                                className="flex-1 min-w-0 flex items-center gap-3 text-left"
                                            >
                                                <Link2 className={cn('h-3.5 w-3.5 flex-shrink-0', inCollection ? 'text-amber-400' : 'text-zoru-ink-muted')} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12.5px] text-zoru-ink truncate">{url.originalUrl}</p>
                                                    <p className="text-[11px] text-zoru-ink-muted">/{url.shortCode}</p>
                                                </div>
                                                {inCollection && (
                                                    <Badge variant="warning" className="text-[10px] flex-shrink-0 mr-2">In collection</Badge>
                                                )}
                                            </button>
                                            <LinkItemActions url={url} onUpdate={loadData} />
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
