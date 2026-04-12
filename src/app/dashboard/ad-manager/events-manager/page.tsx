'use client';

import * as React from 'react';
import { LuBarChart3, LuCircleAlert, LuRefreshCw, LuSend, LuRadio } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAdManager } from '@/context/ad-manager-context';
import { useToast } from '@/hooks/use-toast';
import { listPixels, getPixelStats } from '@/app/actions/ad-manager.actions';
import { getPixelEventStats, sendTestConversionEvent } from '@/app/actions/ad-manager-features.actions';

const TEST_EVENTS = ['PageView', 'Purchase', 'Lead', 'AddToCart', 'InitiateCheckout', 'CompleteRegistration', 'Search', 'ViewContent'] as const;

export default function EventsManagerPage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [pixels, setPixels] = React.useState<any[]>([]);
    const [selectedPixel, setSelectedPixel] = React.useState<string | null>(null);
    const [eventStats, setEventStats] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [statsLoading, setStatsLoading] = React.useState(false);
    const [testDialogOpen, setTestDialogOpen] = React.useState(false);
    const [testEvent, setTestEvent] = React.useState<string>('PageView');
    const [sending, setSending] = React.useState(false);

    const fetchPixels = React.useCallback(async () => {
        if (!activeAccount) return;
        setLoading(true);
        const res = await listPixels(activeAccount.account_id);
        const data = res.data || [];
        setPixels(data);
        if (data.length > 0 && !selectedPixel) {
            setSelectedPixel(data[0].id);
        }
        setLoading(false);
    }, [activeAccount, selectedPixel]);

    React.useEffect(() => { fetchPixels(); }, [fetchPixels]);

    const fetchStats = React.useCallback(async () => {
        if (!selectedPixel) return;
        setStatsLoading(true);
        const res = await getPixelEventStats(selectedPixel);
        setEventStats(res.stats || []);
        setStatsLoading(false);
    }, [selectedPixel]);

    React.useEffect(() => { fetchStats(); }, [fetchStats]);

    const handleSendTest = async () => {
        if (!selectedPixel) return;
        setSending(true);
        const res = await sendTestConversionEvent(selectedPixel, testEvent);
        setSending(false);
        if (res.error) {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
            toast({ title: 'Sent', description: res.message });
            setTestDialogOpen(false);
            fetchStats();
        }
    };

    if (!activeAccount) {
        return (
            <div className="p-8">
                <Alert>
                    <LuCircleAlert className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to view pixel events.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <LuBarChart3 className="h-6 w-6" /> Events manager
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Monitor pixel events, conversion API traffic and offline events.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => { fetchPixels(); fetchStats(); }} disabled={loading || statsLoading}>
                        <LuRefreshCw className={`h-4 w-4 ${(loading || statsLoading) ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                        className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
                        onClick={() => setTestDialogOpen(true)}
                        disabled={!selectedPixel}
                    >
                        <LuSend className="h-4 w-4 mr-1" /> Send Test Event
                    </Button>
                </div>
            </div>

            {/* Pixel selector */}
            {loading ? (
                <div className="flex gap-2">
                    {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10 w-40" />)}
                </div>
            ) : pixels.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-16 text-center">
                        <LuRadio className="h-12 w-12 mx-auto text-muted-foreground" />
                        <p className="mt-3 font-semibold">No pixels found</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Create a pixel in your Meta ad account first.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="flex flex-wrap gap-2">
                        {pixels.map(p => (
                            <Button
                                key={p.id}
                                variant={selectedPixel === p.id ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedPixel(p.id)}
                                className={selectedPixel === p.id ? 'bg-[#1877F2] hover:bg-[#1877F2]/90 text-white' : ''}
                            >
                                <LuRadio className="h-3 w-3 mr-1" />
                                {p.name}
                            </Button>
                        ))}
                    </div>

                    {/* Event stats table */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">
                                Event activity{' '}
                                {selectedPixel && (
                                    <span className="text-xs text-muted-foreground font-normal ml-1">
                                        Pixel: {pixels.find(p => p.id === selectedPixel)?.name || selectedPixel}
                                    </span>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {statsLoading ? (
                                <div className="p-4 space-y-2">
                                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
                                </div>
                            ) : eventStats.length === 0 ? (
                                <div className="py-12 text-center text-muted-foreground">
                                    <p className="font-medium">No events recorded yet</p>
                                    <p className="text-sm mt-1">Use the "Send Test Event" button to fire a test event.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Event name</TableHead>
                                            <TableHead>Count</TableHead>
                                            <TableHead>Last fired</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {eventStats.map((s, i) => (
                                            <TableRow key={i}>
                                                <TableCell>
                                                    <Badge variant="outline">{s.event || s.event_name || s.key || 'Unknown'}</Badge>
                                                </TableCell>
                                                <TableCell className="tabular-nums font-medium">
                                                    {s.count ?? s.value ?? 0}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {s.last_fired_time
                                                        ? new Date(s.last_fired_time).toLocaleString()
                                                        : '\u2014'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Send test event dialog */}
            <Dialog open={testDialogOpen} onOpenChange={(open) => { if (!open) setTestDialogOpen(false); else setTestDialogOpen(true); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Send test event</DialogTitle>
                        <DialogDescription>
                            Send a test conversion event to pixel{' '}
                            {pixels.find(p => p.id === selectedPixel)?.name || selectedPixel}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Event name</Label>
                            <Select value={testEvent} onValueChange={setTestEvent}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {TEST_EVENTS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTestDialogOpen(false)}>Cancel</Button>
                        <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={handleSendTest} disabled={sending}>
                            {sending ? 'Sending\u2026' : 'Send'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
