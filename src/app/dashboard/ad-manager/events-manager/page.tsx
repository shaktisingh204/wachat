'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Skeleton,
  Badge,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
  ZoruDialogFooter,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Label,
} from '@/components/zoruui';
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
                    <ZoruAlertTitle>No ad account selected</ZoruAlertTitle>
                    <ZoruAlertDescription>Pick an ad account to view pixel events.</ZoruAlertDescription>
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
                            className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
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
                    <ZoruCardContent className="py-16 text-center">
                        <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="font-semibold text-lg">No pixels found</p>
                        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                            Create a pixel in your Meta Business Settings first. Pixels are used to track user actions on your website.
                        </p>
                    </ZoruCardContent>
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
                                <Radio className="h-4 w-4 mr-2" />
                                {p.name}
                            </Button>
                        ))}
                    </div>

                    {/* Event stats table */}
                    <Card>
                        <ZoruCardHeader className="pb-2">
                            <ZoruCardTitle className="text-base flex items-center">
                                Event activity
                                {selectedPixel && (
                                    <Badge variant="secondary" className="ml-2 font-normal text-xs">
                                        Pixel ID: {selectedPixel}
                                    </Badge>
                                )}
                            </ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent className="p-0">
                            {statsLoading ? (
                                <div className="p-4 space-y-4">
                                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                                </div>
                            ) : eventStats.length === 0 ? (
                                <div className="py-16 text-center text-muted-foreground">
                                    <ChartBar className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                    <p className="font-medium text-base">No events recorded yet</p>
                                    <p className="text-sm mt-1 max-w-sm mx-auto">Use the "Send Test Event" button above to fire a test conversion event to Meta and verify your connection.</p>
                                </div>
                            ) : (
                                <Table>
                                    <ZoruTableHeader>
                                        <ZoruTableRow>
                                            <ZoruTableHead>Event name</ZoruTableHead>
                                            <ZoruTableHead>Count</ZoruTableHead>
                                            <ZoruTableHead>Last fired</ZoruTableHead>
                                        </ZoruTableRow>
                                    </ZoruTableHeader>
                                    <ZoruTableBody>
                                        {eventStats.map((s, i) => (
                                            <ZoruTableRow key={i}>
                                                <ZoruTableCell>
                                                    <Badge variant="outline" className="font-mono bg-background">{s.event || s.event_name || s.key || 'Unknown'}</Badge>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="tabular-nums font-medium">
                                                    {s.count ?? s.value ?? 0}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-xs text-muted-foreground">
                                                    {s.last_fired_time
                                                        ? new Date(s.last_fired_time).toLocaleString(undefined, {
                                                            dateStyle: 'medium',
                                                            timeStyle: 'short'
                                                          })
                                                        : '—'}
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        ))}
                                    </ZoruTableBody>
                                </Table>
                            )}
                        </ZoruCardContent>
                    </Card>
                </>
            )}

            {/* Send test event dialog */}
            <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
                <ZoruDialogContent className="max-w-sm">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Send test event</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Simulate a conversion event being sent to pixel <span className="font-mono bg-muted px-1 rounded text-xs">{selectedPixel}</span>.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="test-event">Event name</Label>
                            <Select value={testEvent} onValueChange={setTestEvent}>
                                <ZoruSelectTrigger id="test-event">
                                    <ZoruSelectValue placeholder="Select event" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {TEST_EVENTS.map(e => <ZoruSelectItem key={e} value={e}>{e}</ZoruSelectItem>)}
                                </ZoruSelectContent>
                            </Select>
                        </div>
                    </div>
                    <ZoruDialogFooter>
                        <Button variant="outline" onClick={() => setTestDialogOpen(false)} disabled={sending}>Cancel</Button>
                        <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white min-w-[100px]" onClick={handleSendTest} disabled={sending}>
                            {sending ? (
                                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                            ) : (
                                'Send Event'
                            )}
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>
        </div>
    );
}
