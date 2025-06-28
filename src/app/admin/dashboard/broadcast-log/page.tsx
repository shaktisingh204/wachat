
import { getAllBroadcasts } from '@/app/actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { WithId } from 'mongodb';

export const dynamic = 'force-dynamic';

export default async function BroadcastLogPage() {
    const { broadcasts, total } = await getAllBroadcasts(1, 100);

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
                    A raw log of all broadcasts in the database for debugging purposes. Showing {broadcasts.length} of {total} total broadcasts.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>All Broadcasts</CardTitle>
                    <CardDescription>This view is unfiltered and shows all records from the broadcasts collection.</CardDescription>
                </CardHeader>
                <CardContent>
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
                                        No broadcasts found in the database.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
