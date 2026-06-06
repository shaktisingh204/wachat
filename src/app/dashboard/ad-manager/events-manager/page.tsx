'use client';

import {
  Button,
  IconButton,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Alert,
  Skeleton,
  Badge,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Field,
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  ChartBar,
  RefreshCw,
  Send,
  Radio,
  Activity,
} from 'lucide-react';

import * as React from 'react';

import {
  AmBreadcrumb,
  AmHeader,
} from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useAdManager } from '@/context/ad-manager-context';
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
            toast.error('Failed to load pixels.');
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
            toast.error('Failed to load event stats.');
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
                toast.error(res.error);
            } else {
                toast.success(res.message || 'Test event sent successfully.');
                setTestDialogOpen(false);
                fetchStats();
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to send test event.');
        } finally {
            setSending(false);
        }
    };

    if (!mounted) {
        return (
            <div className="space-y-6">
                <AmBreadcrumb page="Events manager" />
                <div className="space-y-2">
                    <Skeleton height={32} width="25%" />
                    <Skeleton height={16} width="33%" />
                </div>
                <Skeleton height={200} width="100%" />
            </div>
        );
    }

    if (!activeAccount) {
        return (
            <div>
                <AmBreadcrumb page="Events manager" />
                <Alert tone="warning" title="No ad account selected" className="mt-6">
                    Pick an ad account to view pixel events.
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
                        <IconButton
                            label="Refresh events"
                            icon={RefreshCw}
                            variant="outline"
                            onClick={() => { fetchPixels(); fetchStats(); }}
                            disabled={loading || statsLoading}
                            className={(loading || statsLoading) ? '[&_svg]:animate-spin' : undefined}
                        />
                        <Button
                            variant="primary"
                            iconLeft={Send}
                            onClick={() => setTestDialogOpen(true)}
                            disabled={!selectedPixel || loading}
                        >
                            Send test event
                        </Button>
                    </div>
                }
            />

            {/* Pixel selector */}
            {loading ? (
                <div className="flex gap-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={40} width={128} />)}
                </div>
            ) : pixels.length === 0 ? (
                <Card>
                    <CardBody>
                        <EmptyState
                            icon={Activity}
                            title="No pixels found"
                            description="Create a pixel in your Meta Business Settings first. Pixels are used to track user actions on your website."
                        />
                    </CardBody>
                </Card>
            ) : (
                <>
                    <div className="flex flex-wrap gap-2">
                        {pixels.map(p => (
                            <Button
                                key={p.id}
                                variant={selectedPixel === p.id ? 'primary' : 'outline'}
                                size="sm"
                                iconLeft={Radio}
                                onClick={() => setSelectedPixel(p.id)}
                            >
                                {p.name}
                            </Button>
                        ))}
                    </div>

                    {/* Event stats table */}
                    <Card padding="none">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Event activity
                                {selectedPixel && (
                                    <Badge tone="neutral" kind="soft">
                                        Pixel ID: {selectedPixel}
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardBody className="p-0">
                            {statsLoading ? (
                                <div className="p-4 space-y-4">
                                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={40} width="100%" />)}
                                </div>
                            ) : eventStats.length === 0 ? (
                                <EmptyState
                                    icon={ChartBar}
                                    title="No events recorded yet"
                                    description='Use the "Send test event" button above to fire a test conversion event to Meta and verify your connection.'
                                />
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
                                                    <Badge tone="neutral" kind="outline" className="font-mono">{s.event || s.event_name || s.key || 'Unknown'}</Badge>
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
                                                        : '-'}
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
                            Simulate a conversion event being sent to pixel <span className="font-mono text-xs px-1 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]">{selectedPixel}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Field label="Event name">
                            <Select value={testEvent} onValueChange={setTestEvent}>
                                <SelectTrigger aria-label="Event name">
                                    <SelectValue placeholder="Select event" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TEST_EVENTS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </Field>
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setTestDialogOpen(false)} disabled={sending}>Cancel</Button>
                        <Button variant="primary" onClick={handleSendTest} loading={sending} className="min-w-[100px]">
                            {sending ? 'Sending...' : 'Send event'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
