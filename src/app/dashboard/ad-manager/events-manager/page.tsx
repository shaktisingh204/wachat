'use client';

import { Button, Card, CardBody, CardHeader, CardTitle, Alert, AlertDescription, AlertTitle, Skeleton, Badge, Table, TBody, Td, Th, THead, Tr, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Label } from '@/components/sabcrm/20ui/compat';
import {
  ChartBar,
  CircleAlert,
  RefreshCw,
  Send,
  Radio,
  Activity
} from 'lucide-react';

import * as React from 'react';

import {
    AmBreadcrumb,
    AmHeader,
} from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useAdManager } from '@/context/ad-manager-context';
import { useToast } from '@/hooks/use-toast';
import { listPixels } from '@/app/actions/ad-manager.actions';
import { getPixelEventStats, sendTestConversionEvent } from '@/app/actions/ad-manager-features.actions';

const TEST_EVENTS = ['PageView', 'Purchase', 'Lead', 'AddToCart', 'InitiateCheckout', 'CompleteRegistration', 'Search', 'ViewContent'] as const;

export default function EventsManagerPage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [mounted, setMounted] = React.useState(false);
    
    const [pixels, setPixels] = React.useState<any[]>([]);
    const [selectedPixel, setSelectedPixel] = React.useState<string | null>(null);
    const [eventStats, setEventStats] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [statsLoading, setStatsLoading] = React.useState(false);
    const [testDialogOpen, setTestDialogOpen] = React.useState(false);
    const [testEvent, setTestEvent] = React.useState<string>('PageView');
    const [sending, setSending] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const fetchPixels = React.useCallback(async () => {
        if (!activeAccount) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await listPixels(activeAccount.account_id);
            const data = res.data || [];
            setPixels(data);
            if (data.length > 0 && !selectedPixel) {
                setSelectedPixel(data[0].id);
            }
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Failed to load pixels.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [activeAccount, selectedPixel, toast]);

    React.useEffect(() => { 
        if (mounted) fetchPixels(); 
    }, [mounted, fetchPixels]);

    const fetchStats = React.useCallback(async () => {
        if (!selectedPixel) return;
        setStatsLoading(true);
        try {
            const res = await getPixelEventStats(selectedPixel);
            setEventStats(res.stats || []);
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Failed to load event stats.', variant: 'destructive' });
        } finally {
            setStatsLoading(false);
        }
    }, [selectedPixel, toast]);

    React.useEffect(() => { 
        if (mounted) fetchStats(); 
    }, [mounted, fetchStats]);

    const handleSendTest = async () => {
        if (!selectedPixel) return;
        setSending(true);
        try {
            const res = await sendTestConversionEvent(selectedPixel, testEvent);
            if (res.error) {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            } else {
                toast({ title: 'Sent', description: res.message || 'Test event sent successfully.' });
                setTestDialogOpen(false);
                fetchStats();
            }
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Failed to send test event.', variant: 'destructive' });
        } finally {
            setSending(false);
        }
    };

    if (!mounted) {
        return (
            <div className="space-y-6">
                <AmBreadcrumb page="Events manager" />
                <div className="space-y-2">
                    <Skeleton className="h-8 w-1/4" />
                    <Skeleton className="h-4 w-1/3" />
                </div>
                <Skeleton className="h-[200px] w-full" />
            </div>
        );
    }

    if (!activeAccount) {
        return (
            <div>
                <AmBreadcrumb page="Events manager" />
                <Alert className="mt-6">
                    <CircleAlert className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to view pixel events.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Events manager" />
            <AmHeader
                title="Events manager"
                description="Monitor pixel events, conversion API traffic and offline events."
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => { fetchPixels(); fetchStats(); }} disabled={loading || statsLoading}>
                            <RefreshCw className={`h-4 w-4 ${(loading || statsLoading) ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                            className="bg-[var(--st-text)] hover:bg-[var(--st-text)]/90 text-white"
                            onClick={() => setTestDialogOpen(true)}
                            disabled={!selectedPixel || loading}
                        >
                            <Send className="h-4 w-4 mr-2" /> Send Test Event
                        </Button>
                    </div>
                }
            />

            {/* Pixel selector */}
            {loading ? (
                <div className="flex gap-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-32" />)}
                </div>
            ) : pixels.length === 0 ? (
                <Card className="border-dashed">
                    <CardBody className="py-16 text-center">
                        <Activity className="h-12 w-12 mx-auto text-[var(--st-text-secondary)] mb-4" />
                        <p className="font-semibold text-lg">No pixels found</p>
                        <p className="text-sm text-[var(--st-text-secondary)] mt-1 max-w-md mx-auto">
                            Create a pixel in your Meta Business Settings first. Pixels are used to track user actions on your website.
                        </p>
                    </CardBody>
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
                                className={selectedPixel === p.id ? 'bg-[var(--st-text)] hover:bg-[var(--st-text)]/90 text-white' : ''}
                            >
                                <Radio className="h-4 w-4 mr-2" />
                                {p.name}
                            </Button>
                        ))}
                    </div>

                    {/* Event stats table */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center">
                                Event activity
                                {selectedPixel && (
                                    <Badge variant="secondary" className="ml-2 font-normal text-xs">
                                        Pixel ID: {selectedPixel}
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardBody className="p-0">
                            {statsLoading ? (
                                <div className="p-4 space-y-4">
                                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                                </div>
                            ) : eventStats.length === 0 ? (
                                <div className="py-16 text-center text-[var(--st-text-secondary)]">
                                    <ChartBar className="h-10 w-10 mx-auto text-[var(--st-text-secondary)]/50 mb-3" />
                                    <p className="font-medium text-base">No events recorded yet</p>
                                    <p className="text-sm mt-1 max-w-sm mx-auto">Use the "Send Test Event" button above to fire a test conversion event to Meta and verify your connection.</p>
                                </div>
                            ) : (
                                <Table>
                                    <THead>
                                        <Tr>
                                            <Th>Event name</Th>
                                            <Th>Count</Th>
                                            <Th>Last fired</Th>
                                        </Tr>
                                    </THead>
                                    <TBody>
                                        {eventStats.map((s, i) => (
                                            <Tr key={i}>
                                                <Td>
                                                    <Badge variant="outline" className="font-mono bg-[var(--st-bg-secondary)]">{s.event || s.event_name || s.key || 'Unknown'}</Badge>
                                                </Td>
                                                <Td className="tabular-nums font-medium">
                                                    {s.count ?? s.value ?? 0}
                                                </Td>
                                                <Td className="text-xs text-[var(--st-text-secondary)]">
                                                    {s.last_fired_time
                                                        ? new Date(s.last_fired_time).toLocaleString(undefined, {
                                                            dateStyle: 'medium',
                                                            timeStyle: 'short'
                                                          })
                                                        : '—'}
                                                </Td>
                                            </Tr>
                                        ))}
                                    </TBody>
                                </Table>
                            )}
                        </CardBody>
                    </Card>
                </>
            )}

            {/* Send test event dialog */}
            <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Send test event</DialogTitle>
                        <DialogDescription>
                            Simulate a conversion event being sent to pixel <span className="font-mono bg-[var(--st-bg-muted)] px-1 rounded text-xs">{selectedPixel}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="test-event">Event name</Label>
                            <Select value={testEvent} onValueChange={setTestEvent}>
                                <SelectTrigger id="test-event">
                                    <SelectValue placeholder="Select event" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TEST_EVENTS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTestDialogOpen(false)} disabled={sending}>Cancel</Button>
                        <Button className="bg-[var(--st-text)] hover:bg-[var(--st-text)]/90 text-white min-w-[100px]" onClick={handleSendTest} disabled={sending}>
                            {sending ? (
                                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                            ) : (
                                'Send Event'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
