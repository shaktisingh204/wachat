import * as React from 'react';
import { Table, TBody, Td, Th, THead, Tr, Badge, Button, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
import { Download, Globe2, Loader2, Trash2 } from 'lucide-react';
import { NumberRow, SectionCard } from './shared';
import type { ProjectSettings, GdprRequestRow } from '@/lib/rust-client/telegram-settings';
import {
    listTelegramGdprRequestsAction,
    requestTelegramDataDeletionAction,
    requestTelegramDataExportAction,
} from '@/app/actions/telegram-settings.actions';
import { useToast } from '@/components/sabcrm/20ui/compat';

export function GdprSection({
    projectId,
    settings,
    setSettings,
    onSave,
    saving,
}: {
    projectId: string;
    settings: ProjectSettings;
    setSettings: React.Dispatch<React.SetStateAction<ProjectSettings>>;
    onSave: () => void;
    saving: boolean;
}) {
    const { toast } = useToast();
    const g = settings.gdpr;
    const update = <K extends keyof typeof g>(key: K, value: (typeof g)[K]) => {
        setSettings((prev) => ({ ...prev, gdpr: { ...prev.gdpr, [key]: value } }));
    };

    const [requests, setRequests] = React.useState<GdprRequestRow[]>([]);
    const [busy, setBusy] = React.useState(false);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [confirm, setConfirm] = React.useState('');
    const [filterKind, setFilterKind] = React.useState<string>('all');
    const [sortOrder, setSortOrder] = React.useState<'desc' | 'asc'>('desc');

    const loadRequests = React.useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await listTelegramGdprRequestsAction(projectId);
            setRequests(res.requests ?? []);
        } catch (e) {
            // handle silently
        }
    }, [projectId]);

    React.useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    // Real-time updates: poll if any request is not done/failed
    React.useEffect(() => {
        const hasPending = requests.some((r) => r.status !== 'done' && r.status !== 'failed');
        if (!hasPending) return;
        const interval = setInterval(() => {
            loadRequests();
        }, 3000);
        return () => clearInterval(interval);
    }, [requests, loadRequests]);

    const requestExport = async () => {
        if (!projectId) return;
        setBusy(true);
        try {
            const res = await requestTelegramDataExportAction(projectId);
            if (res.success) {
                toast({
                    title: 'Export queued',
                    description: res.requestId ? `Request ${res.requestId}` : undefined,
                    variant: 'success',
                });
                await loadRequests();
            } else {
                toast({
                    title: 'Failed to queue export',
                    description: res.error ?? 'Unknown error',
                    variant: 'destructive',
                });
            }
        } catch (e) {
            toast({ title: 'Failed to queue export', variant: 'destructive' });
        } finally {
            setBusy(false);
        }
    };

    const requestDelete = async () => {
        if (!projectId) return;
        setBusy(true);
        try {
            const res = await requestTelegramDataDeletionAction(projectId, confirm);
            if (res.success) {
                toast({ title: 'Deletion queued', variant: 'success' });
                setDialogOpen(false);
                setConfirm('');
                await loadRequests();
            } else {
                toast({
                    title: 'Failed to queue deletion',
                    description: res.error ?? 'Unknown error',
                    variant: 'destructive',
                });
            }
        } catch (e) {
            toast({ title: 'Failed to queue deletion', variant: 'destructive' });
        } finally {
            setBusy(false);
        }
    };

    const filteredRequests = React.useMemo(() => {
        let res = [...requests];
        if (filterKind !== 'all') {
            res = res.filter(r => r.kind === filterKind);
        }
        res.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });
        return res;
    }, [requests, filterKind, sortOrder]);

    return (
        <SectionCard
            icon={Globe2}
            title="GDPR"
            description="Retention and one-shot export/delete requests."
            onSave={onSave}
            saving={saving}
        >
            <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                    <NumberRow
                        label="Data retention (days)"
                        value={g.dataRetentionDays}
                        onChange={(v) => update('dataRetentionDays', v)}
                        min={1}
                    />
                    <NumberRow
                        label="Auto-delete idle chats after (days)"
                        value={g.autoDeleteIdleChatsDays}
                        onChange={(v) => update('autoDeleteIdleChatsDays', v)}
                        min={1}
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button onClick={requestExport} disabled={busy} className="gap-1">
                        <Download className="h-3 w-3" />
                        Request data export
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => setDialogOpen(true)}
                        disabled={busy}
                        className="gap-1"
                    >
                        <Trash2 className="h-3 w-3" />
                        Request data deletion
                    </Button>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-semibold">Recent requests</div>
                        <div className="flex items-center gap-2">
                            <Select value={filterKind} onValueChange={setFilterKind}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="All kinds" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All kinds</SelectItem>
                                    <SelectItem value="export">Export</SelectItem>
                                    <SelectItem value="delete">Delete</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                            >
                                {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
                            </Button>
                        </div>
                    </div>
                    {filteredRequests.length === 0 ? (
                        <p className="text-sm text-[var(--st-text)]/60">No GDPR requests found.</p>
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Created</Th>
                                    <Th>Kind</Th>
                                    <Th>Status</Th>
                                    <Th>Request id</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {filteredRequests.map((r) => (
                                    <Tr key={r._id}>
                                        <Td>{r.createdAt.slice(0, 19).replace('T', ' ')}</Td>
                                        <Td>{r.kind}</Td>
                                        <Td>
                                            <Badge
                                                variant={
                                                    r.status === 'done'
                                                        ? 'success'
                                                        : r.status === 'failed'
                                                          ? 'destructive'
                                                          : 'warning'
                                                }
                                            >
                                                {r.status}
                                            </Badge>
                                        </Td>
                                        <Td className="font-mono text-xs">
                                            {r._id}
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </div>
            </div>

            <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm data deletion</AlertDialogTitle>
                        <AlertDialogDescription>
                            This queues a deletion job for every Telegram artefact attached to
                            this project (bots, chats, broadcasts, deliveries). The job is
                            irreversible once processed. Type <strong>DELETE</strong> to confirm.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Type DELETE"
                    />
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={requestDelete}
                            disabled={confirm !== 'DELETE' || busy}
                        >
                            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                            Queue deletion
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </SectionCard>
    );
}
