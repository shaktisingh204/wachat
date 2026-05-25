import Link from 'next/link';
import { Clock, ShieldAlert, Activity, ArrowRight, ExternalLink } from 'lucide-react';
import { connectToDatabase } from '@/lib/mongodb';
import { ShortUrl } from '@/lib/definitions';
import { Card, Button } from '@/components/zoruui';
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
    let icon = <Clock className="h-8 w-8 text-zinc-400" />;
    
    if (shortUrl) {
        if (shortUrl.status === 'inactive') {
            reasonText = "This link has been deactivated by its creator.";
            icon = <ShieldAlert className="h-8 w-8 text-zinc-400" />;
        } else if (isClickLimitReached) {
            reasonText = `This link has reached its maximum allowed clicks (${shortUrl.clickLimit}).`;
            icon = <Activity className="h-8 w-8 text-zinc-400" />;
        } else if (isDateExpired) {
            reasonText = `This link expired on ${format(new Date(shortUrl.expiresAt!), 'MMM d, yyyy')}.`;
            icon = <Clock className="h-8 w-8 text-zinc-400" />;
        }
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center">
            <Card className="max-w-md w-full p-8 flex flex-col items-center bg-zinc-900 border-zinc-800 shadow-2xl">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800 mb-6 shadow-inner">
                    {icon}
                </div>
                
                <h1 className="text-2xl font-semibold text-white mb-2 tracking-tight">This link has expired</h1>
                
                <p className="text-sm text-zinc-400 max-w-sm mb-6 leading-relaxed">
                    The link you followed is no longer active. {reasonText}
                </p>

                {originalDomain && (
                    <div className="w-full bg-zinc-950 rounded-lg p-4 mb-6 border border-zinc-800/50 flex flex-col gap-1 items-center">
                        <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Destination</span>
                        <div className="flex items-center gap-2 text-zinc-300">
                            <ExternalLink className="h-4 w-4 text-zinc-500" />
                            <span className="font-medium">{originalDomain}</span>
                        </div>
                    </div>
                )}

                <div className="w-full pt-4 border-t border-zinc-800/50">
                    <Link href="/" className="w-full block">
                        <Button variant="outline" className="w-full bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 border-zinc-700">
                            Go to Homepage
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </Card>

            <Link
                href="/"
                className="mt-8 text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1.5"
            >
                <span>Powered by</span>
                <span className="font-semibold text-zinc-500 hover:text-zinc-300">SabNode</span>
            </Link>
        </div>
    );
}
