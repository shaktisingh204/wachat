'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    ArrowLeft,
    Activity,
    CheckCircle2,
    XCircle,
    LoaderCircle,
    PauseCircle,
    RefreshCcw,
    Search,
    FileText,
    Clock,
} from 'lucide-react';
import { getSabFlowExecutions, getSabFlows } from '@/app/actions/sabflow.actions';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNowStrict } from 'date-fns';

type Execution = {
    _id: string;
    flowId: string;
    status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TERMINATED';
    startedAt?: string;
    finishedAt?: string;
    error?: string;
    stopReason?: string;
    history?: Record<string, any>;
    context?: Record<string, any>;
};

const STATUS_CONFIG: Record<string, { Icon: any; color: string; bg: string; label: string }> = {
    RUNNING: { Icon: LoaderCircle, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/40', label: 'Running' },
    COMPLETED: { Icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/40', label: 'Completed' },
    FAILED: { Icon: XCircle, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10 border-rose-500/40', label: 'Failed' },
    TERMINATED: { Icon: PauseCircle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/40', label: 'Terminated' },
};

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.TERMINATED;
    const { Icon } = cfg;
    return (
        <Badge variant="outline" className={cn('gap-1.5 font-semibold text-[10px] uppercase tracking-wider', cfg.bg, cfg.color)}>
            <Icon className={cn('h-3 w-3', status === 'RUNNING' && 'animate-spin')} />
            {cfg.label}
        </Badge>
    );
}

function durationLabel(startedAt?: string, finishedAt?: string): string {
    if (!startedAt) return '—';
    const start = new Date(startedAt).getTime();
    const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
    const diff = Math.max(0, end - start);
    if (diff < 1000) return `${diff}ms`;
    if (diff < 60_000) return `${(diff / 1000).toFixed(1)}s`;
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ${Math.floor((diff % 60_000) / 1000)}s`;
    return `${Math.floor(diff / 3_600_000)}h ${Math.floor((diff % 3_600_000) / 60_000)}m`;
}

export default function SabFlowLogsPage() {
    const [executions, setExecutions] = useState<Execution[]>([]);
    const [flows, setFlows] = useState<{ _id: string; name: string }[]>([]);
    const [isLoading, startTransition] = useTransition();
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [flowFilter, setFlowFilter] = useState<string>('all');
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<Execution | null>(null);

    const fetchData = () => {
        startTransition(async () => {
            const [execs, flowList] = await Promise.all([
                getSabFlowExecutions({
                    status: statusFilter === 'all' ? undefined : statusFilter,
                    flowId: flowFilter === 'all' ? undefined : flowFilter,
                    limit: 100,
                }),
                getSabFlows(),
            ]);
            setExecutions(execs);
            setFlows(flowList.map((f: any) => ({ _id: f._id.toString(), name: f.name })));
        });
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, flowFilter]);

    const flowNameMap = useMemo(() => {
        const m = new Map<string, string>();
        for (const f of flows) m.set(f._id, f.name);
        return m;
    }, [flows]);

    const filteredExecutions = useMemo(() => {
        if (!query.trim()) return executions;
        const q = query.toLowerCase();
        return executions.filter(e => {
            const flowName = flowNameMap.get(String(e.flowId)) || '';
            return (
                flowName.toLowerCase().includes(q) ||
                String(e._id).toLowerCase().includes(q) ||
                (e.error || '').toLowerCase().includes(q)
            );
        });
    }, [executions, query, flowNameMap]);

    const stats = useMemo(() => {
        return {
            total: executions.length,
            completed: executions.filter(e => e.status === 'COMPLETED').length,
            failed: executions.filter(e => e.status === 'FAILED').length,
            running: executions.filter(e => e.status === 'RUNNING').length,
        };
    }, [executions]);

    return (
        <div className="space-y-6" style={{ padding: 30 }}>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
                        <Link href="/dashboard/sabflow/flow-builder">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Flows
                        </Link>
                    </Button>
                    <h1 className="text-2xl md:text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
                        <Activity className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                        Execution Logs
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        History of every flow run — inspect per-step output, errors, and timing.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
                    <RefreshCcw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} /> Refresh
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total Runs', value: stats.total, Icon: Activity, accent: 'violet' as const },
                    { label: 'Completed', value: stats.completed, Icon: CheckCircle2, accent: 'emerald' as const },
                    { label: 'Failed', value: stats.failed, Icon: XCircle, accent: 'rose' as const },
                    { label: 'Running', value: stats.running, Icon: LoaderCircle, accent: 'blue' as const },
                ].map(({ label, value, Icon, accent }) => {
                    const accents = {
                        violet: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', bar: 'from-violet-500/40' },
                        emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', bar: 'from-emerald-500/40' },
                        rose: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', bar: 'from-rose-500/40' },
                        blue: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', bar: 'from-blue-500/40' },
                    }[accent];
                    return (
                        <Card key={label} className="relative overflow-hidden border-border/60">
                            <div className={cn('absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r to-transparent', accents.bar)} />
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center border border-border/40', accents.bg)}>
                                    <Icon className={cn('h-4 w-4', accents.text, label === 'Running' && 'animate-spin')} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">{label}</p>
                                    <p className="text-xl font-bold tracking-tight leading-none mt-1">{value}</p>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Filters + Table */}
            <Card className="border-border/60">
                <CardHeader className="pb-3">
                    <div className="flex flex-col lg:flex-row gap-3">
                        <div className="flex-1">
                            <CardTitle className="text-base">Runs</CardTitle>
                            <CardDescription className="text-xs">
                                Showing {filteredExecutions.length} of {executions.length}
                            </CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-40 h-9">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All statuses</SelectItem>
                                    <SelectItem value="RUNNING">Running</SelectItem>
                                    <SelectItem value="COMPLETED">Completed</SelectItem>
                                    <SelectItem value="FAILED">Failed</SelectItem>
                                    <SelectItem value="TERMINATED">Terminated</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={flowFilter} onValueChange={setFlowFilter}>
                                <SelectTrigger className="w-52 h-9">
                                    <SelectValue placeholder="Flow" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All flows</SelectItem>
                                    {flows.map(f => (
                                        <SelectItem key={f._id} value={f._id}>{f.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="Search runs..."
                                    className="pl-9 h-9 w-full sm:w-56 bg-muted/40 border-border/60"
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading && executions.length === 0 ? (
                        <div className="text-center py-16">
                            <LoaderCircle className="h-8 w-8 animate-spin mx-auto text-primary" />
                            <p className="text-sm text-muted-foreground mt-2">Loading executions…</p>
                        </div>
                    ) : filteredExecutions.length === 0 ? (
                        <div className="text-center py-16 text-sm text-muted-foreground">
                            No execution logs found.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em]">Flow</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em]">Status</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em]">Started</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em]">Duration</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-right">Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredExecutions.map(ex => {
                                    const flowName = flowNameMap.get(String(ex.flowId)) || 'Unknown flow';
                                    return (
                                        <TableRow key={ex._id.toString()} className="cursor-pointer" onClick={() => setSelected(ex)}>
                                            <TableCell className="font-medium">{flowName}</TableCell>
                                            <TableCell><StatusBadge status={ex.status} /></TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-3 w-3" />
                                                    {ex.startedAt ? formatDistanceToNowStrict(new Date(ex.startedAt), { addSuffix: true }) : '—'}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs font-mono">{durationLabel(ex.startedAt, ex.finishedAt)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" className="h-8">
                                                    <FileText className="mr-1.5 h-3.5 w-3.5" /> View
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Detail sheet */}
            {selected && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setSelected(null)}>
                    <div
                        className="absolute right-0 top-0 bottom-0 w-full sm:max-w-xl bg-card border-l shadow-2xl overflow-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-5 border-b sticky top-0 bg-card/95 backdrop-blur-xl">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Execution</p>
                                    <h2 className="text-lg font-bold tracking-tight truncate">
                                        {flowNameMap.get(String(selected.flowId)) || 'Unknown flow'}
                                    </h2>
                                    <p className="text-[10px] text-muted-foreground font-mono mt-1 truncate">{selected._id}</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Close</Button>
                            </div>
                            <div className="mt-3 flex items-center gap-3">
                                <StatusBadge status={selected.status} />
                                <span className="text-xs text-muted-foreground">
                                    {selected.startedAt ? format(new Date(selected.startedAt), 'PPpp') : '—'}
                                </span>
                                <span className="text-xs text-muted-foreground font-mono">
                                    {durationLabel(selected.startedAt, selected.finishedAt)}
                                </span>
                            </div>
                            {selected.error && (
                                <div className="mt-3 p-2.5 rounded-md bg-rose-500/10 border border-rose-500/40 text-xs text-rose-700 dark:text-rose-400 font-mono whitespace-pre-wrap">
                                    {selected.error}
                                </div>
                            )}
                            {selected.stopReason && (
                                <div className="mt-3 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/40 text-xs text-amber-700 dark:text-amber-400">
                                    <span className="font-semibold">Stop reason:</span> {selected.stopReason}
                                </div>
                            )}
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">Step History</h3>
                                {selected.history && Object.keys(selected.history).length > 0 ? (
                                    <div className="space-y-2">
                                        {Object.entries(selected.history).map(([step, result]: any) => {
                                            const hasError = result?.error;
                                            return (
                                                <div key={step} className={cn(
                                                    'rounded-lg border p-3 text-xs',
                                                    hasError ? 'bg-rose-500/5 border-rose-500/40' : 'bg-muted/30 border-border/60'
                                                )}>
                                                    <div className="font-semibold text-sm mb-1">{step}</div>
                                                    <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all max-h-48 overflow-auto">
                                                        {JSON.stringify(result, null, 2)}
                                                    </pre>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground">No step history recorded.</p>
                                )}
                            </div>
                            {selected.context && (
                                <div>
                                    <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">Final Context</h3>
                                    <pre className="rounded-lg border border-border/60 bg-muted/30 p-3 font-mono text-[11px] whitespace-pre-wrap break-all max-h-64 overflow-auto">
                                        {JSON.stringify(selected.context, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
