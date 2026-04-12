'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import {
    ArrowLeft,
    Cable,
    Plus,
    Trash2,
    LoaderCircle,
    Search,
    KeyRound,
    CheckCircle2,
    Plug,
} from 'lucide-react';
import { getSabFlowConnections, deleteSabFlowConnection } from '@/app/actions/sabflow.actions';
import { sabnodeAppActions } from '@/lib/sabflow/apps';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type Connection = {
    _id: string;
    appId: string;
    appName: string;
    connectionName: string;
    credentials?: Record<string, any>;
    createdAt?: string;
};

function DeleteConnectionButton({ connection, onDeleted }: { connection: Connection; onDeleted: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteSabFlowConnection(connection._id);
            if (result.message) {
                toast({ title: 'Success', description: result.message });
                onDeleted();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
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
                    <AlertDialogTitle>Remove connection?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will disconnect &quot;{connection.connectionName}&quot; from {connection.appName}. Any flows using this
                        connection will stop working until reconnected.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Remove
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default function SabFlowConnectionsPage() {
    const [connections, setConnections] = useState<Connection[]>([]);
    const [isLoading, startTransition] = useTransition();
    const [query, setQuery] = useState('');

    const fetchData = () => {
        startTransition(async () => {
            const data = await getSabFlowConnections();
            setConnections(data);
        });
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Build a map of available apps that support external connections
    const connectableApps = useMemo(() => {
        return sabnodeAppActions.filter(
            (a: any) => a.connectionType === 'apikey' || a.connectionType === 'oauth' || a.connectionType === 'webhook'
        );
    }, []);

    const connectionsByAppId = useMemo(() => {
        const map = new Map<string, Connection[]>();
        for (const c of connections) {
            const list = map.get(c.appId) || [];
            list.push(c);
            map.set(c.appId, list);
        }
        return map;
    }, [connections]);

    const filteredApps = useMemo(() => {
        if (!query.trim()) return connectableApps;
        const q = query.toLowerCase();
        return connectableApps.filter((a: any) => a.name.toLowerCase().includes(q));
    }, [connectableApps, query]);

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
                        <Cable className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                        Connections
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage credentials for third-party apps used inside your flows. Connections are reusable across flows.
                    </p>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search apps..."
                        className="pl-9 h-9 bg-muted/40 border-border/60"
                    />
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="border-border/60">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-violet-500/10 border border-border/40 flex items-center justify-center">
                            <Plug className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">Active Connections</p>
                            <p className="text-2xl font-bold tracking-tight leading-none mt-1">{connections.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/60">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-border/40 flex items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">Connected Apps</p>
                            <p className="text-2xl font-bold tracking-tight leading-none mt-1">{connectionsByAppId.size}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/60">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-amber-500/10 border border-border/40 flex items-center justify-center">
                            <KeyRound className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">Available Integrations</p>
                            <p className="text-2xl font-bold tracking-tight leading-none mt-1">{connectableApps.length}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* App grid */}
            <Card className="border-border/60">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Available Integrations</CardTitle>
                    <CardDescription className="text-xs">
                        Connect an app below. After connecting, its actions become available in the flow builder.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading && connections.length === 0 ? (
                        <div className="text-center py-12">
                            <LoaderCircle className="h-8 w-8 animate-spin mx-auto text-primary" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredApps.map((app: any) => {
                                const appConns = connectionsByAppId.get(app.appId) || [];
                                const AppIcon = app.icon;
                                const connected = appConns.length > 0;
                                return (
                                    <div
                                        key={app.appId}
                                        className={cn(
                                            'group relative rounded-xl border p-4 transition-all',
                                            connected ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/60 bg-card/50 hover:border-violet-500/40 hover:bg-violet-500/5'
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="h-11 w-11 shrink-0 rounded-xl bg-background border border-border/40 flex items-center justify-center">
                                                <AppIcon className={cn('h-5 w-5', app.iconColor)} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <h3 className="font-semibold text-sm truncate">{app.name}</h3>
                                                        <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                                                            {app.connectionType} • {app.category || 'Integration'}
                                                        </p>
                                                    </div>
                                                    {connected && (
                                                        <Badge variant="outline" className="gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600 border-emerald-500/40 bg-emerald-500/5 dark:text-emerald-400">
                                                            <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                                                            Connected
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {connected && (
                                            <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5">
                                                {appConns.map((c: Connection) => (
                                                    <div key={c._id} className="flex items-center justify-between text-[11px]">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-medium truncate">{c.connectionName}</div>
                                                            {c.createdAt && (
                                                                <div className="text-[10px] text-muted-foreground">
                                                                    Added {format(new Date(c.createdAt), 'PP')}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <DeleteConnectionButton connection={c} onDeleted={fetchData} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {!connected && (
                                            <div className="mt-3 pt-3 border-t border-border/40">
                                                <p className="text-[11px] text-muted-foreground mb-2">
                                                    To connect, open a flow and select <span className="font-semibold">{app.name}</span> in the
                                                    properties panel — it will prompt for credentials.
                                                </p>
                                                <Button variant="outline" size="sm" className="w-full h-8 text-xs" asChild>
                                                    <Link href="/dashboard/sabflow/flow-builder">
                                                        <Plus className="mr-1.5 h-3 w-3" /> Use in a flow
                                                    </Link>
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {filteredApps.length === 0 && !isLoading && (
                        <div className="text-center py-10 text-sm text-muted-foreground">
                            No integrations match &quot;{query}&quot;.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
