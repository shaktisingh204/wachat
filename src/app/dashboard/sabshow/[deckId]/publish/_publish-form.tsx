'use client';

import { useState, useTransition } from 'react';

import {
    Button,
    Card,
    Input,
    Label,
    Textarea,
} from '@/components/zoruui';
import {
    publishSabshowDeck,
    unpublishSabshowDeck,
} from '@/app/actions/sabshow.actions';
import type { SabshowPublicationDoc } from '@/lib/rust-client/sabshow-publications';

interface PublishFormProps {
    deckId: string;
    existing: SabshowPublicationDoc | null;
}

export function PublishForm({ deckId, existing }: PublishFormProps) {
    const [slug, setSlug] = useState(existing?.slug ?? '');
    const [customCss, setCustomCss] = useState(existing?.customCss ?? '');
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [pub, setPub] = useState<SabshowPublicationDoc | null>(existing);

    const shareUrl =
        typeof window !== 'undefined' && pub
            ? `${window.location.origin}/present/${encodeURIComponent(pub.slug)}`
            : pub
              ? `/present/${pub.slug}`
              : null;

    function submit() {
        if (!slug.trim()) {
            setError('slug is required');
            return;
        }
        setError(null);
        startTransition(async () => {
            try {
                const next = await publishSabshowDeck({
                    deckId,
                    slug: slug.trim(),
                    customCss: customCss || undefined,
                });
                setPub(next);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to publish');
            }
        });
    }

    function unpublish() {
        if (!pub?._id) return;
        startTransition(async () => {
            await unpublishSabshowDeck(pub._id!, deckId);
            setPub(null);
            setSlug('');
        });
    }

    return (
        <Card className="space-y-4 p-4">
            <div className="space-y-2">
                <Label htmlFor="slug">URL slug</Label>
                <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="q1-board-review"
                />
                <p className="text-xs text-muted-foreground">
                    Public URL:{' '}
                    <code>/present/{slug || '<slug>'}</code>
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="customCss">Custom CSS (optional)</Label>
                <Textarea
                    id="customCss"
                    rows={5}
                    value={customCss}
                    onChange={(e) => setCustomCss(e.target.value)}
                    placeholder=":root { --sabshow-accent: #000; }"
                />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex flex-wrap items-center gap-2">
                <Button onClick={submit} disabled={pending}>
                    {pub ? 'Update publication' : 'Publish'}
                </Button>
                {pub ? (
                    <Button variant="ghost" onClick={unpublish} disabled={pending}>
                        Unpublish
                    </Button>
                ) : null}
                {shareUrl ? (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (typeof navigator !== 'undefined') {
                                void navigator.clipboard?.writeText(shareUrl);
                            }
                        }}
                    >
                        Copy share URL
                    </Button>
                ) : null}
            </div>

            {pub ? (
                <div className="rounded border bg-muted/40 p-3 text-xs">
                    Status: <strong>{pub.status ?? 'live'}</strong> · pinned to v
                    {pub.publishedVersion}
                </div>
            ) : null}
        </Card>
    );
}
