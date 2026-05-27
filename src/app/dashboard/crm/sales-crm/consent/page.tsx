'use client';

import {
    Badge,
    Button,
    Card,
    Checkbox,
    Input,
    Label,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    Skeleton,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/zoruui';
import * as React from 'react';
import { Download, Search } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';

import {
    getPurposeConsents,
    getLeadConsents,
    getPurposeConsentLeads,
    grantLeadConsent,
    revokeLeadConsent,
} from '@/app/actions/worksuite/gdpr.actions';
import type {
    WsPurposeConsent,
    WsPurposeConsentLead,
} from '@/lib/worksuite/gdpr-types';

type PurposeRow = WsPurposeConsent & { _id: string };
type ConsentRow = WsPurposeConsentLead & { _id: string };

type StateFilter = 'all' | 'granted' | 'revoked';

function formatDateTime(value?: Date | string) {
    if (!value) return '—';
    const d = new Date(value as Date | string);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString();
}

function StatCard({ title, value, accent }: { title: string; value: number; accent?: string }) {
    return (
        <Card>
            <p className="text-[13px] font-medium text-zoru-ink-muted">{title}</p>
            <p className="mt-1 text-[28px] font-semibold text-zoru-ink">
                {value.toLocaleString()}
            </p>
            {accent ? <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{accent}</p> : null}
        </Card>
    );
}

function csvEscape(value: unknown): string {
    const s = value == null ? '' : String(value);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

/**
 * Lead consent — per-lead consent management AND tenant-wide consent
 * log dashboard. Top KPIs aggregate every recorded consent event in the
 * tenant; the bottom panel scopes to a single lead for grant/revoke.
 */
export default function LeadConsentPage() {
    const { toast } = useZoruToast();
    const [leadId, setLeadId] = React.useState('');
    const [activeLeadId, setActiveLeadId] = React.useState('');
    const [purposes, setPurposes] = React.useState<PurposeRow[]>([]);
    const [allEvents, setAllEvents] = React.useState<ConsentRow[]>([]);
    const [history, setHistory] = React.useState<ConsentRow[]>([]);
    const [selected, setSelected] = React.useState<Record<string, boolean>>({});
    const [isLoading, startLoading] = React.useTransition();
    const [pending, startPending] = React.useTransition();

    const [search, setSearch] = React.useState('');
    const [stateFilter, setStateFilter] = React.useState<StateFilter>('all');
    const [purposeFilter, setPurposeFilter] = React.useState<string>('');

    const loadPurposes = React.useCallback(() => {
        startLoading(async () => {
            try {
                const list = (await getPurposeConsents()) as PurposeRow[];
                const filtered = (Array.isArray(list) ? list : []).filter(
                    (p) =>
                        p.is_active !== false &&
                        (p.applies_to === 'lead' ||
                            p.applies_to === 'both' ||
                            p.applies_to === undefined),
                );
                setPurposes(filtered);
            } catch (e) {
                console.error('Failed to load purposes:', e);
            }
        });
    }, []);

    const loadAllEvents = React.useCallback(async () => {
        try {
            const list = (await getPurposeConsentLeads()) as ConsentRow[];
            setAllEvents(Array.isArray(list) ? list : []);
        } catch (e) {
            console.error('Failed to load consent events:', e);
            setAllEvents([]);
        }
    }, []);

    React.useEffect(() => {
        loadPurposes();
        loadAllEvents();
    }, [loadPurposes, loadAllEvents]);

    const loadHistory = React.useCallback(async (id: string) => {
        if (!id) {
            setHistory([]);
            return;
        }
        try {
            const list = (await getLeadConsents(id)) as ConsentRow[];
            setHistory(Array.isArray(list) ? list : []);
        } catch (e) {
            console.error('Failed to load lead consents:', e);
            setHistory([]);
        }
    }, []);

    const onLookup = () => {
        const trimmed = leadId.trim();
        if (!trimmed) {
            toast({
                title: 'Lead required',
                description: 'Pick a lead to manage its consents.',
                variant: 'destructive',
            });
            return;
        }
        setActiveLeadId(trimmed);
        setSelected({});
        loadHistory(trimmed);
    };

    /* ─── Per-lead derived ─────────────────────────────────────────── */

    const latestByPurpose = React.useMemo(() => {
        const map = new Map<string, ConsentRow>();
        for (const row of history) {
            const existing = map.get(row.purpose_consent_id);
            const rowTime = row.granted_at ? new Date(row.granted_at as Date | string).getTime() : 0;
            const prevTime =
                existing && existing.granted_at
                    ? new Date(existing.granted_at as Date | string).getTime()
                    : -1;
            if (!existing || rowTime >= prevTime) {
                map.set(row.purpose_consent_id, row);
            }
        }
        return map;
    }, [history]);

    /* ─── Tenant-wide derived ──────────────────────────────────────── */

    const purposeNameById = React.useMemo(() => {
        const map = new Map<string, string>();
        for (const p of purposes) map.set(p._id, p.title);
        return map;
    }, [purposes]);

    const filteredEvents = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return allEvents.filter((ev) => {
            if (stateFilter === 'granted' && ev.granted !== true) return false;
            if (stateFilter === 'revoked' && ev.granted === true) return false;
            if (purposeFilter && ev.purpose_consent_id !== purposeFilter) return false;
            if (!q) return true;
            const purposeName = purposeNameById.get(ev.purpose_consent_id) ?? '';
            return (
                ev.lead_id?.toLowerCase().includes(q) ||
                purposeName.toLowerCase().includes(q) ||
                (ev.ip_address ?? '').toLowerCase().includes(q)
            );
        });
    }, [allEvents, search, stateFilter, purposeFilter, purposeNameById]);

    const kpis = React.useMemo(() => {
        const total = allEvents.length;
        const granted = allEvents.filter((e) => e.granted === true).length;
        const revoked = allEvents.filter((e) => e.granted === false).length;
        const byPurpose = new Map<string, number>();
        for (const ev of allEvents) {
            byPurpose.set(ev.purpose_consent_id, (byPurpose.get(ev.purpose_consent_id) ?? 0) + 1);
        }
        let topPurposeId = '';
        let topCount = -1;
        for (const [pid, c] of byPurpose) {
            if (c > topCount) {
                topCount = c;
                topPurposeId = pid;
            }
        }
        const topPurposeName = topPurposeId ? purposeNameById.get(topPurposeId) ?? 'Unknown' : '—';
        return { total, granted, revoked, byPurposeCount: byPurpose.size, topPurposeName };
    }, [allEvents, purposeNameById]);

    /* ─── Bulk export ──────────────────────────────────────────────── */

    const exportCsv = React.useCallback(() => {
        const rows = filteredEvents;
        if (rows.length === 0) {
            toast({
                title: 'Nothing to export',
                description: 'Adjust filters to include at least one event.',
            });
            return;
        }
        const header = ['lead_id', 'purpose', 'state', 'granted_at', 'ip_address', 'user_agent'];
        const lines = [header.join(',')];
        for (const ev of rows) {
            lines.push(
                [
                    csvEscape(ev.lead_id),
                    csvEscape(purposeNameById.get(ev.purpose_consent_id) ?? ev.purpose_consent_id),
                    csvEscape(ev.granted ? 'granted' : 'revoked'),
                    csvEscape(ev.granted_at ? new Date(ev.granted_at as Date | string).toISOString() : ''),
                    csvEscape(ev.ip_address ?? ''),
                    csvEscape(ev.user_agent ?? ''),
                ].join(','),
            );
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `consent-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Exported', description: `${rows.length} event(s) downloaded.` });
    }, [filteredEvents, purposeNameById, toast]);

    /* ─── Grant / revoke ───────────────────────────────────────────── */

    const togglePurpose = (pid: string, value: boolean) => {
        setSelected((prev) => ({ ...prev, [pid]: value }));
    };

    const onGrant = () => {
        if (!activeLeadId) return;
        const ids = Object.entries(selected)
            .filter(([, v]) => v)
            .map(([k]) => k);
        if (ids.length === 0) {
            toast({
                title: 'Nothing selected',
                description: 'Tick one or more purposes to grant consent.',
                variant: 'destructive',
            });
            return;
        }
        startPending(async () => {
            const res = await grantLeadConsent(activeLeadId, ids);
            if (res.success) {
                toast({
                    title: 'Consent granted',
                    description: `${res.count ?? ids.length} purpose(s) recorded.`,
                });
                setSelected({});
                loadHistory(activeLeadId);
                loadAllEvents();
            } else {
                toast({
                    title: 'Error',
                    description: res.error || 'Failed to grant',
                    variant: 'destructive',
                });
            }
        });
    };

    const onRevoke = (pid: string) => {
        if (!activeLeadId) return;
        startPending(async () => {
            const res = await revokeLeadConsent(activeLeadId, pid);
            if (res.success) {
                toast({ title: 'Revoked', description: 'Consent revoked.' });
                loadHistory(activeLeadId);
                loadAllEvents();
            } else {
                toast({
                    title: 'Error',
                    description: res.error || 'Failed to revoke',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <EntityListShell
            title="Lead Consent"
            subtitle="Record purpose consents and revocations per lead with IP/UA capture."
            primaryAction={
                <Button variant="outline" size="sm" onClick={exportCsv}>
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                </Button>
            }
        >
            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                    title="Consent records"
                    value={kpis.total}
                    accent={`${kpis.byPurposeCount} purpose(s)`}
                />
                <StatCard title="Granted" value={kpis.granted} accent="Currently or previously granted" />
                <StatCard title="Revoked" value={kpis.revoked} accent="Revocation events" />
                <StatCard title="Active purposes" value={purposes.length} accent={`Top: ${kpis.topPurposeName}`} />
            </div>

            {/* Filters + tenant-wide log */}
            <Card>
                <div className="mb-4 flex flex-wrap items-end gap-3">
                    <div className="min-w-[200px] flex-1">
                        <Label className="text-zoru-ink">Search</Label>
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search lead, purpose, IP…"
                            leadingSlot={<Search aria-hidden="true" />}
                        />
                    </div>
                    <div className="min-w-[160px]">
                        <Label className="text-zoru-ink">State</Label>
                        <Select
                            value={stateFilter}
                            onValueChange={(v) => setStateFilter(v as StateFilter)}
                        >
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="All" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All</ZoruSelectItem>
                                <ZoruSelectItem value="granted">Granted</ZoruSelectItem>
                                <ZoruSelectItem value="revoked">Revoked</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="min-w-[200px]">
                        <Label className="text-zoru-ink">Purpose</Label>
                        <Select value={purposeFilter} onValueChange={setPurposeFilter}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="All purposes" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {purposes.map((p) => (
                                    <ZoruSelectItem key={p._id} value={p._id}>
                                        {p.title}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <Table>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Lead</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Purpose</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">State</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">When</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">IP</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {filteredEvents.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={5} className="py-6 text-center text-[13px] text-zoru-ink-muted">
                                        No consent events match your filters.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                filteredEvents.slice(0, 200).map((row) => (
                                    <ZoruTableRow key={row._id} className="border-zoru-line">
                                        <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                            {row.lead_id}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-zoru-ink">
                                            {purposeNameById.get(row.purpose_consent_id) ?? row.purpose_consent_id}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <Badge variant={row.granted ? 'success' : 'destructive'}>
                                                {row.granted ? 'Granted' : 'Revoked'}
                                            </Badge>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                                            {formatDateTime(row.granted_at)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                                            {row.ip_address || '—'}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            )}
                        </ZoruTableBody>
                    </Table>
                </div>
                {filteredEvents.length > 200 ? (
                    <p className="mt-2 text-[11.5px] text-zoru-ink-muted">
                        Showing first 200 of {filteredEvents.length.toLocaleString()} — export for the full set.
                    </p>
                ) : null}
            </Card>

            {/* Per-lead lookup */}
            <Card>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[240px] flex-1">
                        <Label className="text-zoru-ink">Lead</Label>
                        <div className="mt-1.5">
                            <EntityFormField
                                entity="lead"
                                name="__lead_picker"
                                initialId={leadId || null}
                                onChange={(id) => setLeadId(id ?? '')}
                                placeholder="Pick a lead…"
                            />
                        </div>
                    </div>
                    <Button onClick={onLookup}>Load</Button>
                </div>
            </Card>

            {activeLeadId ? (
                <>
                    <Card>
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-[14px] font-semibold text-zoru-ink">Active purposes</h2>
                            <Button disabled={pending} onClick={onGrant}>
                                Grant selected
                            </Button>
                        </div>
                        {isLoading && purposes.length === 0 ? (
                            <div className="space-y-2">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                            </div>
                        ) : purposes.length === 0 ? (
                            <p className="text-[13px] text-zoru-ink-muted">
                                No active purposes configured yet.
                            </p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-zoru-line">
                                <Table>
                                    <ZoruTableHeader>
                                        <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                            <ZoruTableHead className="w-[40px]" />
                                            <ZoruTableHead className="text-zoru-ink-muted">Purpose</ZoruTableHead>
                                            <ZoruTableHead className="text-zoru-ink-muted">State</ZoruTableHead>
                                            <ZoruTableHead className="text-zoru-ink-muted">Last updated</ZoruTableHead>
                                            <ZoruTableHead className="w-[120px] text-right text-zoru-ink-muted">Actions</ZoruTableHead>
                                        </ZoruTableRow>
                                    </ZoruTableHeader>
                                    <ZoruTableBody>
                                        {purposes.map((p) => {
                                            const latest = latestByPurpose.get(p._id);
                                            const isGranted = latest?.granted === true;
                                            return (
                                                <ZoruTableRow key={p._id} className="border-zoru-line">
                                                    <ZoruTableCell>
                                                        <Checkbox
                                                            checked={!!selected[p._id]}
                                                            onCheckedChange={(v) => togglePurpose(p._id, !!v)}
                                                            aria-label={`Select ${p.title}`}
                                                        />
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                                                        <div className="font-medium">{p.title}</div>
                                                        {p.description ? (
                                                            <div className="text-[11.5px] text-zoru-ink-muted">
                                                                {p.description}
                                                            </div>
                                                        ) : null}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell>
                                                        {latest ? (
                                                            <Badge variant={isGranted ? 'success' : 'destructive'}>
                                                                {isGranted ? 'Granted' : 'Revoked'}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="ghost">No record</Badge>
                                                        )}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                                                        {formatDateTime(latest?.granted_at)}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-right">
                                                        {isGranted ? (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                disabled={pending}
                                                                onClick={() => onRevoke(p._id)}
                                                            >
                                                                Revoke
                                                            </Button>
                                                        ) : null}
                                                    </ZoruTableCell>
                                                </ZoruTableRow>
                                            );
                                        })}
                                    </ZoruTableBody>
                                </Table>
                            </div>
                        )}
                    </Card>

                    <Card>
                        <h2 className="mb-3 text-[14px] font-semibold text-zoru-ink">History</h2>
                        {history.length === 0 ? (
                            <p className="text-[13px] text-zoru-ink-muted">
                                No consent events recorded for this lead yet.
                            </p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-zoru-line">
                                <Table>
                                    <ZoruTableHeader>
                                        <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                            <ZoruTableHead className="text-zoru-ink-muted">Purpose</ZoruTableHead>
                                            <ZoruTableHead className="text-zoru-ink-muted">State</ZoruTableHead>
                                            <ZoruTableHead className="text-zoru-ink-muted">Timestamp</ZoruTableHead>
                                            <ZoruTableHead className="text-zoru-ink-muted">IP</ZoruTableHead>
                                        </ZoruTableRow>
                                    </ZoruTableHeader>
                                    <ZoruTableBody>
                                        {history.map((row) => {
                                            const p = purposes.find((x) => x._id === row.purpose_consent_id);
                                            return (
                                                <ZoruTableRow key={row._id} className="border-zoru-line">
                                                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                                                        {p ? p.title : row.purpose_consent_id}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell>
                                                        <Badge variant={row.granted ? 'success' : 'destructive'}>
                                                            {row.granted ? 'Granted' : 'Revoked'}
                                                        </Badge>
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                                                        {formatDateTime(row.granted_at)}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                                                        {row.ip_address || '—'}
                                                    </ZoruTableCell>
                                                </ZoruTableRow>
                                            );
                                        })}
                                    </ZoruTableBody>
                                </Table>
                            </div>
                        )}
                    </Card>
                </>
            ) : null}
        </EntityListShell>
    );
}
