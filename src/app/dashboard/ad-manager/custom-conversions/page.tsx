'use client';

import * as React from 'react';
import { Target, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAdManager } from '@/context/ad-manager-context';
import { listCustomConversions } from '@/app/actions/ad-manager.actions';

export default function CustomConversionsPage() {
    const { activeAccount } = useAdManager();
    const [conversions, setConversions] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!activeAccount) return;
        (async () => {
            setLoading(true);
            const res = await listCustomConversions(activeAccount.account_id);
            setConversions(res.data || []);
            setLoading(false);
        })();
    }, [activeAccount]);

    if (!activeAccount) {
        return (
            <div className="p-8">
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to view custom conversions.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Target className="h-6 w-6" /> Custom conversions
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Define URL-based or rule-based conversion events without code changes.
                    </p>
                </div>
                <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
                    <Plus className="h-4 w-4 mr-1" /> New custom conversion
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-4 space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Event type</TableHead>
                                    <TableHead>Last fired</TableHead>
                                    <TableHead>Default value</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {conversions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                            No custom conversions yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    conversions.map((c) => (
                                        <TableRow key={c.id}>
                                            <TableCell className="font-medium">
                                                {c.name}
                                                {c.description && (
                                                    <div className="text-xs text-muted-foreground">{c.description}</div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{c.custom_event_type || 'OTHER'}</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {c.last_fired_time
                                                    ? new Date(c.last_fired_time).toLocaleString()
                                                    : '—'}
                                            </TableCell>
                                            <TableCell className="tabular-nums">
                                                {c.default_conversion_value || '—'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
