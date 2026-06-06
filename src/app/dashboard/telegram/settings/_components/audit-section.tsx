import * as React from 'react';
import {
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    Button,
    Input,
    EmptyState,
} from '@/components/sabcrm/20ui/compat';
import { ChevronRight, ClipboardList, Loader2 } from 'lucide-react';
import { SectionCard } from './shared';
import type { AuditRow } from '@/lib/rust-client/telegram-settings';
import { listTelegramSettingsAuditAction } from '@/app/actions/telegram-settings.actions';
import { useZoruToast } from '@/components/sabcrm/20ui/compat';

export function AuditSection({ projectId }: { projectId: string }) {
    const { toast } = useZoruToast();
    const [rows, setRows] = React.useState<AuditRow[]>([]);
    const [nextCursor, setNextCursor] = React.useState<string | undefined>(undefined);
    const [loading, setLoading] = React.useState(false);
    const [filterText, setFilterText] = React.useState('');

    const loadAudit = React.useCallback(
        async (cursor?: string) => {
            if (!projectId) return;
            setLoading(true);
            try {
                const res = await listTelegramSettingsAuditAction(projectId, { cursor, limit: 50 });
                if (cursor) {
                    setRows((prev) => [...prev, ...(res.rows ?? [])]);
                } else {
                    setRows(res.rows ?? []);
                }
                setNextCursor(res.nextCursor);
            } catch (e) {
                toast({ title: 'Failed to load audit logs', variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        },
        [projectId, toast],
    );

    React.useEffect(() => {
        loadAudit();
    }, [loadAudit]);

    const onLoadMore = () => {
        if (nextCursor) {
            loadAudit(nextCursor);
        }
    };

    const filteredRows = React.useMemo(() => {
        if (!filterText) return rows;
        const lower = filterText.toLowerCase();
        return rows.filter(r => 
            r.actorId.toLowerCase().includes(lower) || 
            r.field.toLowerCase().includes(lower)
        );
    }, [rows, filterText]);

    return (
        <SectionCard
            icon={ClipboardList}
            title="Audit"
            description="Every successful settings save is recorded here."
        >
            <div className="mb-4">
                <Input
                    placeholder="Filter by actor or field..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="max-w-xs"
                />
            </div>
            {rows.length === 0 ? (
                <EmptyState
                    title="No audit entries yet"
                    description="Once you save changes here, diffs will appear in this list."
                />
            ) : (
                <>
                    <Table>
                        <ZoruTableHeader>
                            <ZoruTableRow>
                                <ZoruTableHead>When</ZoruTableHead>
                                <ZoruTableHead>Actor</ZoruTableHead>
                                <ZoruTableHead>Field</ZoruTableHead>
                                <ZoruTableHead>Change</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {filteredRows.map((r) => (
                                <ZoruTableRow key={r._id}>
                                    <ZoruTableCell className="whitespace-nowrap text-xs">
                                        {r.changedAt.slice(0, 19).replace('T', ' ')}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="font-mono text-xs">
                                        {r.actorId}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="font-mono text-xs">
                                        {r.field}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-xs">
                                        <span className="font-mono text-zoru-ink">
                                            {r.oldValue.length > 60
                                                ? `${r.oldValue.slice(0, 60)}…`
                                                : r.oldValue || '∅'}
                                        </span>
                                        <ChevronRight className="mx-1 inline h-3 w-3 align-middle" />
                                        <span className="font-mono text-zoru-ink">
                                            {r.newValue.length > 60
                                                ? `${r.newValue.slice(0, 60)}…`
                                                : r.newValue || '∅'}
                                        </span>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ))}
                        </ZoruTableBody>
                    </Table>
                    {filteredRows.length === 0 && (
                        <p className="text-sm text-center text-zoru-fg/60 mt-4">No matching audit entries.</p>
                    )}
                    {nextCursor ? (
                        <div className="flex justify-center pt-3">
                            <Button variant="outline" onClick={onLoadMore} disabled={loading}>
                                {loading ? (
                                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                ) : null}
                                Load more
                            </Button>
                        </div>
                    ) : null}
                </>
            )}
        </SectionCard>
    );
}
