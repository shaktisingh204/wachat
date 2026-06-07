import Link from 'next/link';
import { Clock, ShieldAlert, Activity, ArrowRight, ExternalLink } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { connectToDatabase } from '@/lib/mongodb';
import { ShortUrl } from '@/lib/definitions';
import { Card, Button, EmptyState } from '@/components/sabcrm/20ui';
import { format } from 'date-fns';

import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Link Expired | SabNode',
    description: 'The link you are trying to access has expired or is no longer active.',
};

type PageProps = {
    searchParams: Promise<{ code?: string }>;
};

export default async function ExpiredLinkPage({ searchParams }: PageProps) {
    const resolvedParams = await searchParams;
    const { code } = resolvedParams;

    let shortUrl: ShortUrl | null = null;
    let originalDomain = '';

    if (code) {
        const { db } = await connectToDatabase();
        shortUrl = await db.collection('short_urls').findOne({ shortCode: code }) as ShortUrl | null;
        if (shortUrl?.originalUrl) {
            try {
                const url = new URL(shortUrl.originalUrl);
                originalDomain = url.hostname;
            } catch (e) {
                // Ignore
            }
        }
    }

    const isClickLimitReached = shortUrl?.clickLimit && shortUrl.clickCount >= shortUrl.clickLimit;
    const isDateExpired = shortUrl?.expiresAt && new Date(shortUrl.expiresAt) < new Date();

    let reasonText = 'It may have reached its expiry date or click limit.';
    let ReasonIcon: LucideIcon = Clock;

    if (shortUrl) {
        if (shortUrl.status === 'inactive') {
            reasonText = 'This link has been deactivated by its creator.';
            ReasonIcon = ShieldAlert;
        } else if (isClickLimitReached) {
            reasonText = `This link has reached its maximum allowed clicks (${shortUrl.clickLimit}).`;
            ReasonIcon = Activity;
        } else if (isDateExpired) {
            reasonText = `This link expired on ${format(new Date(shortUrl.expiresAt!), 'MMM d, yyyy')}.`;
            ReasonIcon = Clock;
        }
    }

    return (
        <div className="ui20 min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
                <Card variant="elevated" padding="lg" className="w-full max-w-md">
                    <EmptyState
                        icon={ReasonIcon}
                        title="This link has expired"
                        description={`The link you followed is no longer active. ${reasonText}`}
                        action={
                            <div className="flex w-full flex-col gap-6">
                                {originalDomain && (
                                    <div className="flex w-full flex-col items-center gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-4">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
                                            Destination
                                        </span>
                                        <div className="flex items-center gap-2 text-[var(--st-text)]">
                                            <ExternalLink className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                                            <span className="font-medium">{originalDomain}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="w-full border-t border-[var(--st-border)] pt-6">
                                    <Link href="/" className="block w-full">
                                        <Button variant="outline" block iconRight={ArrowRight}>
                                            Go to Homepage
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        }
                    />
                </Card>

                <Link
                    href="/"
                    className="mt-8 flex items-center gap-1.5 text-xs text-[var(--st-text-secondary)] transition-colors hover:text-[var(--st-text)]"
                >
                    <span>Powered by</span>
                    <span className="font-semibold">SabNode</span>
                </Link>
            </div>
        </div>
    );
}
