
import { getAllBroadcasts } from '@/app/actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { WithId } from 'mongodb';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

const BROADCASTS_PER_PAGE = 20;

export default async function BroadcastLogPage({
    searchParams,
}: {
    searchParams?: { page?: string };
}) {
    const currentPage = Number(searchParams?.page) || 1;
    const { broadcasts, total } = await getAllBroadcasts(currentPage, BROADCASTS_PER_PAGE);

    const totalPages = Math.ceil(total / BROADCASTS_PER_PAGE);

    const getStatusVariant = (status?: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
        if (!status) return 'secondary';
        const lowerStatus = status.toLowerCase();
        if (lowerStatus === 'completed') return 'default';
        if (lowerStatus === 'queued' || lowerStatus === 'processing' || lowerStatus === 'partial failure' || lowerStatus === 'cancelled') return 'secondary';
        return 'destructive';
    };

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">System-Wide Broadcast Log</h1>
                <p className="text-muted-foreground">
                    A raw log of all broadcasts in the database for debugging purposes. Page {currentPage} of {totalPages}.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>All Broadcasts</CardTitle>
                    <CardDescription>This view is unfiltered and shows all records from the broadcasts collection. Total: {total.toLocaleString()}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Timestamp</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Template Name</TableHead>
                                    <TableHead>Project ID</TableHead>
                                    <TableHead>Stats</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {broadcasts.length > 0 ? (
                                    broadcasts.map((broadcast) => (
                                        <TableRow key={broadcast._id.toString()}>
                                            <TableCell>{new Date(broadcast.createdAt).toLocaleString()}</TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusVariant(broadcast.status)} className="capitalize">
                                                    {broadcast.status?.toLowerCase() || 'unknown'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{broadcast.templateName || 'N/A'}</TableCell>
                                            <TableCell className="font-mono text-xs">{broadcast.projectId?.toString() || 'N/A'}</TableCell>
                                            <TableCell>{`${broadcast.successCount || 0} sent / ${broadcast.errorCount || 0} failed`}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No broadcasts found for this page.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                     <div className="flex items-center justify-end space-x-2 py-4">
                        <Button
                            variant="outline"
                            size="sm"
                            asChild
                            disabled={currentPage <= 1}
                        >
                           <Link href={`/admin/dashboard/broadcast-log?page=${currentPage - 1}`}>Previous</Link>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            asChild
                            disabled={currentPage >= totalPages}
                        >
                           <Link href={`/admin/dashboard/broadcast-log?page=${currentPage + 1}`}>Next</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
