import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  getShortUrlById,
  getCustomDomains } from '@/app/actions/url-shortener.actions';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft,
  BarChart2,
  Calendar,
  Link as LinkIcon,
  NotebookPen } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { ShortUrl } from '@/lib/definitions';
import type { WithId } from 'mongodb';

export const dynamic = 'force-dynamic';

export default async function ShortUrlAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [url, domains] = await Promise.all([
        getShortUrlById(id),
        getCustomDomains(),
    ]);

    if (!url) {
        notFound();
    }

    const getShortUrl = (shortUrlDoc: WithId<ShortUrl>) => {
        if (shortUrlDoc.domainId) {
            const domain = domains.find(d => d._id.toString() === shortUrlDoc.domainId);
            if (domain) {
                const protocol = 'https://'; // Assume https for custom domains
                return `${protocol}${domain.hostname}/${shortUrlDoc.shortCode}`;
            }
        }
        // Fallback to default domain
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
        return `${baseUrl}/s/${shortUrlDoc.shortCode}`;
    }

    return (
        <div className="space-y-6">
            <div>
                <ZoruButton variant="ghost" asChild className="mb-4 -ml-4">
                    <Link href="/dashboard/url-shortener"><ArrowLeft className="mr-2 h-4 w-4" />Back to All Links</Link>
                </ZoruButton>
                <h1 className="text-3xl text-zoru-ink flex items-center gap-3"><BarChart2 /> Analytics</h1>
                <a href={getShortUrl(url)} target="_blank" rel="noopener noreferrer" className="text-zoru-ink hover:underline break-all">
                    {getShortUrl(url)}
                </a>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <ZoruCard>
                    <ZoruCardHeader><ZoruCardTitle className="text-sm flex items-center justify-between">Destination URL <LinkIcon className="h-4 w-4 text-zoru-ink-muted" /></ZoruCardTitle></ZoruCardHeader>
                    <ZoruCardContent><p className="text-lg text-zoru-ink truncate">{url.originalUrl}</p></ZoruCardContent>
                </ZoruCard>
                <ZoruCard>
                    <ZoruCardHeader><ZoruCardTitle className="text-sm flex items-center justify-between">Total Clicks <NotebookPen className="h-4 w-4 text-zoru-ink-muted" /></ZoruCardTitle></ZoruCardHeader>
                    <ZoruCardContent><p className="text-3xl text-zoru-ink">{url.clickCount.toLocaleString()}</p></ZoruCardContent>
                </ZoruCard>
                <ZoruCard>
                    <ZoruCardHeader><ZoruCardTitle className="text-sm flex items-center justify-between">Created / Expires <Calendar className="h-4 w-4 text-zoru-ink-muted" /></ZoruCardTitle></ZoruCardHeader>
                    <ZoruCardContent><p className="text-lg text-zoru-ink">{new Date(url.createdAt).toLocaleDateString()} / {url.expiresAt ? new Date(url.expiresAt).toLocaleDateString() : 'Never'}</p></ZoruCardContent>
                </ZoruCard>
            </div>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Click Log</ZoruCardTitle>
                    <ZoruCardDescription>A log of the most recent clicks on this link.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="border border-zoru-line rounded-md">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Timestamp</ZoruTableHead>
                                    <ZoruTableHead>Referrer</ZoruTableHead>
                                    <ZoruTableHead>User Agent</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {url.analytics.length > 0 ? (
                                    [...url.analytics].reverse().map((click, index) => (
                                        <ZoruTableRow key={index}>
                                            <ZoruTableCell>{formatDistanceToNow(new Date(click.timestamp), { addSuffix: true })}</ZoruTableCell>
                                            <ZoruTableCell className="font-mono text-xs max-w-xs truncate">{click.referrer || 'Direct'}</ZoruTableCell>
                                            <ZoruTableCell className="font-mono text-xs max-w-sm truncate">{click.userAgent}</ZoruTableCell>
                                        </ZoruTableRow>
                                    ))
                                ) : (
                                    <ZoruTableRow>
                                        <ZoruTableCell colSpan={3} className="text-center h-24">No clicks yet.</ZoruTableCell>
                                    </ZoruTableRow>
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </ZoruCardContent>
            </ZoruCard>

        </div>
    );
}
