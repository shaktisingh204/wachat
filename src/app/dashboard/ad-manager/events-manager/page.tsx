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
  Radio } from 'lucide-react';

import * as React from 'react';

import {
    AmBreadcrumb,
    AmHeader,
} from '@/app/dashboard/ad-manager/_components/am-page-shell';
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
            <div>
                <AmBreadcrumb page="Events manager" />
                <ZoruAlert className="mt-6">
                    <CircleAlert className="h-4 w-4" />
                    <ZoruAlertTitle>No ad account selected</ZoruAlertTitle>
                    <ZoruAlertDescription>Pick an ad account to view pixel events.</ZoruAlertDescription>
                </ZoruAlert>
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
                        <ZoruButton variant="outline" size="icon" onClick={() => { fetchPixels(); fetchStats(); }} disabled={loading || statsLoading}>
                            <RefreshCw className={`h-4 w-4 ${(loading || statsLoading) ? 'animate-spin' : ''}`} />
                        </ZoruButton>
                        <ZoruButton
                            className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
                            onClick={() => setTestDialogOpen(true)}
                            disabled={!selectedPixel}
                        >
                            <Send className="h-4 w-4 mr-1" /> Send Test Event
                        </ZoruButton>
                    </div>
                }
            />

            {/* Pixel selector */}
            {loading ? (
                <div className="flex gap-2">
                    {Array.from({ length: 2 }).map((_, i) => <ZoruSkeleton key={i} className="h-10 w-40" />)}
                </div>
            ) : pixels.length === 0 ? (
                <ZoruCard className="border-dashed">
                    <ZoruCardContent className="py-16 text-center">
                        <Radio className="h-12 w-12 mx-auto text-muted-foreground" />
                        <p className="mt-3 font-semibold">No pixels found</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Create a pixel in your Meta ad account first.
                        </p>
                    </ZoruCardContent>
                </ZoruCard>
            ) : (
                <>
                    <div className="flex flex-wrap gap-2">
                        {pixels.map(p => (
                            <ZoruButton
                                key={p.id}
                                variant={selectedPixel === p.id ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedPixel(p.id)}
                                className={selectedPixel === p.id ? 'bg-[#1877F2] hover:bg-[#1877F2]/90 text-white' : ''}
                            >
                                <Radio className="h-3 w-3 mr-1" />
                                {p.name}
                            </ZoruButton>
                        ))}
                    </div>

                    {/* Event stats table */}
                    <ZoruCard>
                        <ZoruCardHeader className="pb-2">
                            <ZoruCardTitle className="text-base">
                                Event activity{' '}
                                {selectedPixel && (
                                    <span className="text-xs text-muted-foreground font-normal ml-1">
                                        Pixel: {pixels.find(p => p.id === selectedPixel)?.name || selectedPixel}
                                    </span>
                                )}
                            </ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent className="p-0">
                            {statsLoading ? (
                                <div className="p-4 space-y-2">
                                    {Array.from({ length: 4 }).map((_, i) => <ZoruSkeleton key={i} className="h-10" />)}
                                </div>
                            ) : eventStats.length === 0 ? (
                                <div className="py-12 text-center text-muted-foreground">
                                    <p className="font-medium">No events recorded yet</p>
                                    <p className="text-sm mt-1">Use the "Send Test Event" button to fire a test event.</p>
                                </div>
                            ) : (
                                <ZoruTable>
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
                                                    <ZoruBadge variant="outline">{s.event || s.event_name || s.key || 'Unknown'}</ZoruBadge>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="tabular-nums font-medium">
                                                    {s.count ?? s.value ?? 0}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-xs text-muted-foreground">
                                                    {s.last_fired_time
                                                        ? new Date(s.last_fired_time).toLocaleString()
                                                        : '—'}
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        ))}
                                    </ZoruTableBody>
                                </ZoruTable>
                            )}
                        </ZoruCardContent>
                    </ZoruCard>
                </>
            )}

            {/* Send test event dialog */}
            <ZoruDialog open={testDialogOpen} onOpenChange={(open) => { if (!open) setTestDialogOpen(false); else setTestDialogOpen(true); }}>
                <ZoruDialogContent className="max-w-sm">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Send test event</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Send a test conversion event to pixel{' '}
                            {pixels.find(p => p.id === selectedPixel)?.name || selectedPixel}.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <ZoruLabel>Event name</ZoruLabel>
                            <ZoruSelect value={testEvent} onValueChange={setTestEvent}>
                                <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {TEST_EVENTS.map(e => <ZoruSelectItem key={e} value={e}>{e}</ZoruSelectItem>)}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                    </div>
                    <ZoruDialogFooter>
                        <ZoruButton variant="outline" onClick={() => setTestDialogOpen(false)}>Cancel</ZoruButton>
                        <ZoruButton className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={handleSendTest} disabled={sending}>
                            {sending ? 'Sending…' : 'Send'}
                        </ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>
        </div>
    );
}
