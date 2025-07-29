import { getShortUrlById, getCustomDomains } from '@/app/actions/url-shortener.actions';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BarChart2, Calendar, Link as LinkIcon, NotebookPen } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { ShortUrl } from '@/lib/definitions';
import type { WithId } from 'mongodb';

export const dynamic = 'force-dynamic';

export default async function ShortUrlAnalyticsPage({ params }: { params: { id: string } }) {
    const [url, domains] = await Promise.all([
        getShortUrlById(params.id),
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
                 <Button variant="ghost" asChild className="mb-4 -ml-4">
                    <Link href="/dashboard/url-shortener"><ArrowLeft className="mr-2 h-4 w-4" />Back to All Links</Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><BarChart2/> Analytics</h1>
                <a href={getShortUrl(url)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                    {getShortUrl(url)}
                </a>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                    <CardHeader><CardTitle className="text-sm font-medium flex items-center justify-between">Destination URL <LinkIcon className="h-4 w-4 text-muted-foreground"/></CardTitle></CardHeader>
                    <CardContent><p className="text-lg font-semibold truncate">{url.originalUrl}</p></CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle className="text-sm font-medium flex items-center justify-between">Total Clicks <NotebookPen className="h-4 w-4 text-muted-foreground"/></CardTitle></CardHeader>
                    <CardContent><p className="text-3xl font-bold">{url.clickCount.toLocaleString()}</p></CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle className="text-sm font-medium flex items-center justify-between">Created / Expires <Calendar className="h-4 w-4 text-muted-foreground"/></CardTitle></CardHeader>
                    <CardContent><p className="text-lg font-semibold">{new Date(url.createdAt).toLocaleDateString()} / {url.expiresAt ? new Date(url.expiresAt).toLocaleDateString() : 'Never'}</p></CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Click Log</CardTitle>
                    <CardDescription>A log of the most recent clicks on this link.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Timestamp</TableHead>
                                    <TableHead>Referrer</TableHead>
                                    <TableHead>User Agent</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {url.analytics.length > 0 ? (
                                    [...url.analytics].reverse().map((click, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{formatDistanceToNow(new Date(click.timestamp), { addSuffix: true })}</TableCell>
                                            <TableCell className="font-mono text-xs max-w-xs truncate">{click.referrer || 'Direct'}</TableCell>
                                            <TableCell className="font-mono text-xs max-w-sm truncate">{click.userAgent}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center h-24">No clicks yet.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

        </div>
    );
}
