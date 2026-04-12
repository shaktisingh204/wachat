
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import {
    Zap,
    GitFork,
    LoaderCircle,
    Trash2,
    Workflow,
    Activity,
    PauseCircle,
    Webhook,
    PlayCircle,
    Calendar,
    BookOpen,
    Search,
    Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from "react";
import { getSabFlows, deleteSabFlow } from "@/app/actions/sabflow.actions";
import type { WithId, SabFlow } from "@/lib/definitions";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateSabFlowDialog } from "@/components/wabasimplify/create-sabflow-dialog";
import { cn } from "@/lib/utils";

function DeleteFlowButton({ flow, onDeleted }: { flow: WithId<SabFlow>, onDeleted: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteSabFlow(flow._id.toString());
            if (result.message) {
                toast({ title: "Success", description: result.message });
                onDeleted();
            } else {
                toast({ title: "Error", description: result.error, variant: 'destructive' });
            }
        });
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" disabled={isPending}>
                    {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Flow?</AlertDialogTitle>
                    <AlertDialogDescription>Are you sure you want to delete the &quot;{flow.name}&quot; flow? This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function StatCard({
    label,
    value,
    Icon,
    accent,
}: {
    label: string;
    value: number | string;
    Icon: React.ComponentType<{ className?: string }>;
    accent: 'violet' | 'emerald' | 'amber';
}) {
    const accents = {
        violet: {
            iconBg: 'bg-violet-500/10 dark:bg-violet-400/10',
            iconText: 'text-violet-600 dark:text-violet-400',
            bar: 'from-violet-500/40 via-violet-500/10 to-transparent',
        },
        emerald: {
            iconBg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
            iconText: 'text-emerald-600 dark:text-emerald-400',
            bar: 'from-emerald-500/40 via-emerald-500/10 to-transparent',
        },
        amber: {
            iconBg: 'bg-amber-500/10 dark:bg-amber-400/10',
            iconText: 'text-amber-600 dark:text-amber-400',
            bar: 'from-amber-500/40 via-amber-500/10 to-transparent',
        },
    }[accent];
    return (
        <Card className="relative overflow-hidden border-border/60">
            <div className={cn("absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r", accents.bar)} />
            <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center border border-border/40", accents.iconBg)}>
                    <Icon className={cn("h-5 w-5", accents.iconText)} />
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">{label}</p>
                    <p className="text-2xl font-bold tracking-tight leading-none mt-1">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}

const triggerIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    webhook: Webhook,
    manual: PlayCircle,
    schedule: Calendar,
    app: Zap,
};

function TriggerCell({ trigger }: { trigger: any }) {
    const type = trigger?.triggerType || trigger?.type || 'manual';
    const Icon = triggerIconMap[type] || PlayCircle;
    const label = typeof type === 'string' ? type.charAt(0).toUpperCase() + type.slice(1) : 'Manual';
    return (
        <div className="inline-flex items-center gap-1.5 text-xs">
            <span className="h-6 w-6 rounded-md bg-muted/60 border border-border/40 flex items-center justify-center">
                <Icon className="h-3 w-3 text-muted-foreground" />
            </span>
            <span className="text-muted-foreground">{label}</span>
        </div>
    );
}

export default function SabFlowBuilderPage() {
    const [flows, setFlows] = useState<WithId<SabFlow>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const [query, setQuery] = useState('');

    const fetchData = () => {
        startTransition(async () => {
            const data = await getSabFlows();
            setFlows(data);
        });
    };

    useEffect(() => {
        fetchData();
    }, []);

    const stats = useMemo(() => {
        const total = flows.length;
        const active = flows.filter(f => (f.status || 'ACTIVE') !== 'PAUSED').length;
        const paused = total - active;
        return { total, active, paused };
    }, [flows]);

    const filteredFlows = useMemo(() => {
        if (!query.trim()) return flows;
        const q = query.toLowerCase();
        return flows.filter(f => f.name?.toLowerCase().includes(q));
    }, [flows, query]);

    if (isLoading && flows.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3" style={{ padding: 30 }}>
                <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading your flows…</p>
            </div>
        );
    }

    if (flows.length === 0) {
        return (
            <div className="flex justify-center items-center h-full" style={{ padding: 30 }}>
                <Card className="text-center max-w-2xl w-full animate-fade-in-up border-border/60 overflow-hidden">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-emerald-500/10 pointer-events-none" />
                        <CardHeader className="relative pt-10">
                            <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-violet-500/15 to-emerald-500/15 border border-border/40 flex items-center justify-center shadow-sm">
                                <Workflow className="h-10 w-10 text-violet-600 dark:text-violet-400" />
                            </div>
                            <CardTitle className="mt-5 text-2xl font-bold tracking-tight">Create your first SabFlow</CardTitle>
                            <CardDescription className="max-w-md mx-auto">
                                Automate repetitive tasks by visually connecting triggers and actions across all your SabNode apps.
                            </CardDescription>
                        </CardHeader>
                    </div>
                    <CardContent className="pb-0">
                        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                            {[
                                { Icon: Zap, label: 'Triggers' },
                                { Icon: GitFork, label: 'Conditions' },
                                { Icon: Workflow, label: 'Actions' },
                            ].map(({ Icon, label }) => (
                                <div key={label} className="rounded-lg border border-border/60 bg-muted/30 p-3 flex flex-col items-center gap-1.5">
                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                    <CardFooter className="justify-center gap-2 pt-6 pb-8">
                        <Button variant="outline" asChild>
                            <Link href="/dashboard/sabflow/docs">
                                <BookOpen className="mr-2 h-4 w-4" /> View Docs
                            </Link>
                        </Button>
                        <CreateSabFlowDialog onSuccess={fetchData} />
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6" style={{ padding: 30 }}>
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
                        <Workflow className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                        Your Flows
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Build, manage and monitor automated workflows across your SabNode apps.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/dashboard/sabflow/docs">
                            <BookOpen className="mr-2 h-4 w-4" /> Docs
                        </Link>
                    </Button>
                    <CreateSabFlowDialog onSuccess={fetchData} />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard label="Total Flows" value={stats.total} Icon={Workflow} accent="violet" />
                <StatCard label="Active" value={stats.active} Icon={Activity} accent="emerald" />
                <StatCard label="Paused" value={stats.paused} Icon={PauseCircle} accent="amber" />
            </div>

            {/* Search + Table */}
            <Card className="border-border/60">
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <CardTitle className="text-base">All Flows</CardTitle>
                            <CardDescription className="text-xs">
                                {filteredFlows.length} of {flows.length} flow{flows.length === 1 ? '' : 's'}
                            </CardDescription>
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search flows..."
                                className="pl-9 h-9 bg-muted/40 border-border/60"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em]">Flow Name</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em]">Status</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em]">Trigger</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em]">Last Updated</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredFlows.map(flow => {
                                const isPaused = flow.status === 'PAUSED';
                                return (
                                    <TableRow key={flow._id.toString()} className="group">
                                        <TableCell className="font-medium">
                                            <Link
                                                href={`/dashboard/sabflow/flow-builder/${flow._id.toString()}`}
                                                className="inline-flex items-center gap-2 hover:text-primary transition-colors"
                                            >
                                                <span className="h-7 w-7 rounded-md bg-violet-500/10 border border-border/40 flex items-center justify-center">
                                                    <Workflow className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                                                </span>
                                                {flow.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "gap-1.5 font-semibold text-[10px] uppercase tracking-wider",
                                                    isPaused
                                                        ? "text-amber-600 border-amber-500/40 bg-amber-500/5 dark:text-amber-400"
                                                        : "text-emerald-600 border-emerald-500/40 bg-emerald-500/5 dark:text-emerald-400"
                                                )}
                                            >
                                                <span className={cn(
                                                    "h-1.5 w-1.5 rounded-full",
                                                    isPaused ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
                                                )} />
                                                {isPaused ? 'Paused' : 'Active'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <TriggerCell trigger={flow.trigger} />
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {flow.updatedAt ? format(new Date(flow.updatedAt), 'PPP') : '—'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="inline-flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="sm" className="h-8" asChild>
                                                    <Link href={`/dashboard/sabflow/flow-builder/${flow._id.toString()}`}>
                                                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                                                    </Link>
                                                </Button>
                                                <DeleteFlowButton flow={flow} onDeleted={fetchData} />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {filteredFlows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10 text-sm text-muted-foreground">
                                        No flows match &quot;{query}&quot;
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
