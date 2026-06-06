'use client';

import Link from 'next/link';
import { useState, useEffect, useTransition } from 'react';
import {
    PageHeader,
    PageHeading,
    PageTitle,
    PageDescription,
    Card,
    Button,
    Badge,
    EmptyState,
    Skeleton,
    cn,
    useToast,
} from '@/components/sabcrm/20ui';
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
    const { toast } = useToast();

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
                toast({ title: 'Error', description: 'Failed to load collections or URLs', tone: 'danger' });
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
                toast({ title: 'Error', description: 'Failed to update collection', tone: 'danger' });
            }
        });
    };

    return (
        <div className="flex flex-col gap-6 p-6">
            <PageHeader>
                <PageHeading>
                    <PageTitle>Collections</PageTitle>
                    <PageDescription>
                        Organise your short links into named folders. Select a collection, then toggle links to add or remove them.
                    </PageDescription>
                </PageHeading>
            </PageHeader>

            <div className="flex gap-4 min-h-[400px]">
                <div className="w-56 flex-shrink-0 space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--st-text-tertiary)] mb-2 px-1">Your Collections</p>
                    {isLoading ? (
                        <div className="space-y-2 mt-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : collections.length === 0 ? (
                        <Card padding="md" className="text-center text-[12px] text-[var(--st-text-secondary)] mt-2">
                            No collections yet.
                            <Link
                                href="/dashboard/url-shortener"
                                className="mt-1 block text-[var(--st-accent)] hover:underline"
                            >
                                Create one on the Links page
                            </Link>
                        </Card>
                    ) : (
                        collections.map((col) => (
                            <Button
                                key={col._id}
                                variant="ghost"
                                onClick={() => setSelectedCollection(col._id)}
                                aria-pressed={selectedCollection === col._id}
                                className={cn(
                                    'w-full justify-start gap-2 px-3 py-2 text-[12.5px] rounded-[var(--st-radius)] border',
                                    selectedCollection === col._id
                                        ? 'border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]'
                                        : 'border-transparent text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)]'
                                )}
                            >
                                <span
                                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: col.color }}
                                    aria-hidden="true"
                                />
                                <span className="truncate flex-1 text-left">{col.name}</span>
                                <Badge tone="neutral" className="text-[10px]">{col.linkIds?.length || 0}</Badge>
                            </Button>
                        ))
                    )}
                </div>

                <div className="flex-1">
                    {!selectedCollection ? (
                        <EmptyState
                            icon={FolderOpen}
                            title="Select a collection to manage its links"
                            description="Pick a collection on the left, then toggle links to add or remove them."
                            className="h-full justify-center"
                        />
                    ) : (
                        <div className="space-y-2">
                            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--st-text-tertiary)] mb-3 px-1">
                                Links, click to toggle assignment to{' '}
                                <span style={{ color: selectedCol?.color }}>{selectedCol?.name}</span>
                            </p>
                            {isLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-14 w-full" />
                                    <Skeleton className="h-14 w-full" />
                                    <Skeleton className="h-14 w-full" />
                                </div>
                            ) : urls.length === 0 ? (
                                <EmptyState
                                    icon={Link2}
                                    title="No links yet"
                                    description="Create a short link on the Links page to start organising."
                                    size="sm"
                                />
                            ) : (
                                urls.map((url) => {
                                    const id = url._id.toString();
                                    const inCollection = assignedIds.has(id);
                                    return (
                                        <div
                                            key={id}
                                            className={cn(
                                                'group w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--st-radius)] border text-left transition-colors',
                                                inCollection
                                                    ? 'border-[var(--st-accent)]/40 bg-[var(--st-accent)]/5'
                                                    : 'border-[var(--st-border)] hover:border-[var(--st-border-strong)] hover:bg-[var(--st-bg-secondary)]'
                                            )}
                                        >
                                            <Button
                                                variant="ghost"
                                                onClick={() => handleToggle(id)}
                                                disabled={isPending}
                                                aria-pressed={inCollection}
                                                className="flex-1 min-w-0 justify-start gap-3 px-0 text-left hover:bg-transparent"
                                            >
                                                <Link2 className="h-3.5 w-3.5 flex-shrink-0 text-[var(--st-text-secondary)]" aria-hidden="true" />
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-[12.5px] text-[var(--st-text)] truncate">{url.originalUrl}</span>
                                                    <span className="block text-[11px] text-[var(--st-text-secondary)]">/{url.shortCode}</span>
                                                </span>
                                                {inCollection && (
                                                    <Badge tone="success" className="text-[10px] flex-shrink-0 mr-2">In collection</Badge>
                                                )}
                                            </Button>
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
