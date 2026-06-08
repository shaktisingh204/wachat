'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, Globe, Link2, Send } from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
    Field,
    Input,
    Textarea,
} from '@/components/sabcrm/20ui';
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
    const [copied, setCopied] = useState(false);

    const shareUrl =
        typeof window !== 'undefined' && pub
            ? `${window.location.origin}/present/${encodeURIComponent(pub.slug)}`
            : pub
              ? `/present/${pub.slug}`
              : null;

    function submit() {
        if (!slug.trim()) {
            setError('Enter a URL slug to publish.');
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
                setError(e instanceof Error ? e.message : 'We could not publish the deck. Please try again.');
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

    function copyShareUrl() {
        if (!shareUrl || typeof navigator === 'undefined') return;
        void navigator.clipboard?.writeText(shareUrl).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        });
    }

    return (
        <div className="space-y-4">
            <Card padding="md" className="space-y-4">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Link2 size={16} aria-hidden="true" />
                        Public link
                    </CardTitle>
                    <CardDescription>
                        The slug becomes the path anyone can open without signing in.
                    </CardDescription>
                </CardHeader>

                <Field
                    label="URL slug"
                    id="slug"
                    error={error ?? undefined}
                    help={
                        <>
                            Public URL: <code>/present/{slug || 'your-slug'}</code>
                        </>
                    }
                >
                    <Input
                        prefix="/present/"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="q1-board-review"
                    />
                </Field>

                <Field
                    label="Custom CSS"
                    id="customCss"
                    help="Optional. Override theme variables for the published view only."
                >
                    <Textarea
                        rows={5}
                        value={customCss}
                        onChange={(e) => setCustomCss(e.target.value)}
                        placeholder=":root { --sabshow-accent: #4f46e5; }"
                    />
                </Field>

                <div className="flex flex-wrap items-center gap-2">
                    <Button iconLeft={Send} onClick={submit} loading={pending} disabled={pending}>
                        {pub ? 'Update publication' : 'Publish'}
                    </Button>
                    {pub ? (
                        <Button variant="ghost" onClick={unpublish} disabled={pending}>
                            Unpublish
                        </Button>
                    ) : null}
                </div>
            </Card>

            {pub ? (
                <Card padding="md" className="space-y-3">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Globe size={16} aria-hidden="true" />
                            Live publication
                        </CardTitle>
                    </CardHeader>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                        <Badge tone="success" kind="soft">
                            {pub.status ?? 'live'}
                        </Badge>
                        <span className="tabular-nums">Pinned to v{pub.publishedVersion}</span>
                    </div>
                    {shareUrl ? (
                        <div className="flex items-center gap-2">
                            <Input readOnly value={shareUrl} aria-label="Share URL" />
                            <Button
                                variant="outline"
                                size="sm"
                                iconLeft={copied ? Check : Copy}
                                onClick={copyShareUrl}
                            >
                                {copied ? 'Copied' : 'Copy'}
                            </Button>
                        </div>
                    ) : null}
                </Card>
            ) : null}
        </div>
    );
}
