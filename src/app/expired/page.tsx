import "@/components/sabcrm/20ui/zoru-legacy.css";

import Link from 'next/link';
import { Clock, ShieldAlert, Activity, ArrowRight, ExternalLink } from 'lucide-react';
import { connectToDatabase } from '@/lib/mongodb';
import { ShortUrl } from '@/lib/definitions';
import { Card, Button } from '@/components/sabcrm/20ui';
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

    let reasonText = "It may have reached its expiry date or click limit.";
    let icon = <Clock className="h-8 w-8 text-[var(--st-text-secondary)]" />;

    if (shortUrl) {
        if (shortUrl.status === 'inactive') {
            reasonText = "This link has been deactivated by its creator.";
            icon = <ShieldAlert className="h-8 w-8 text-[var(--st-text-secondary)]" />;
        } else if (isClickLimitReached) {
            reasonText = `This link has reached its maximum allowed clicks (${shortUrl.clickLimit}).`;
            icon = <Activity className="h-8 w-8 text-[var(--st-text-secondary)]" />;
        } else if (isDateExpired) {
            reasonText = `This link expired on ${format(new Date(shortUrl.expiresAt!), 'MMM d, yyyy')}.`;
            icon = <Clock className="h-8 w-8 text-[var(--st-text-secondary)]" />;
        }
    }

    return (
        <div className="zoruui min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--st-bg)] px-4 text-center">
                <Card className="max-w-md w-full p-8 flex flex-col items-center bg-[var(--st-bg-secondary)] border border-[var(--st-border)] shadow-2xl">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--st-bg-secondary)] mb-6 shadow-inner">
                        {icon}
                    </div>

                    <h1 className="text-2xl font-semibold text-[var(--st-text)] mb-2 tracking-tight">This link has expired</h1>

                    <p className="text-sm text-[var(--st-text-secondary)] max-w-sm mb-6 leading-relaxed">
                        The link you followed is no longer active. {reasonText}
                    </p>

                    {originalDomain && (
                        <div className="w-full bg-[var(--st-bg)] rounded-lg p-4 mb-6 border border-[var(--st-border)] flex flex-col gap-1 items-center">
                            <span className="text-xs text-[var(--st-text-secondary)] uppercase tracking-wider font-semibold">Destination</span>
                            <div className="flex items-center gap-2 text-[var(--st-text)]">
                                <ExternalLink className="h-4 w-4 text-[var(--st-text-secondary)]" />
                                <span className="font-medium">{originalDomain}</span>
                            </div>
                        </div>
                    )}

                    <div className="w-full pt-4 border-t border-[var(--st-border)]">
                        <Link href="/" className="w-full block">
                            <Button variant="outline" className="w-full">
                                Go to Homepage
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Link>
                    </div>
                </Card>

                <Link
                    href="/"
                    className="mt-8 text-xs text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors flex items-center gap-1.5"
                >
                    <span>Powered by</span>
                    <span className="font-semibold">SabNode</span>
                </Link>
            </div>
        </div>
    );
}
