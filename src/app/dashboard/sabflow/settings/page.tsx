
'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
    Settings,
    KeyRound,
    Activity,
    Bell,
    Shield,
    ArrowLeft,
    Cable,
    Workflow,
    CheckCircle2,
    LoaderCircle,
    Clock,
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { getSession } from '@/app/actions';
import { getSabFlowConnections, getSabFlows } from '@/app/actions/sabflow.actions';

type PlanInfo = {
    name: string;
    flowLimit: number;
    features?: Record<string, any>;
};

export default function SabFlowSettingsPage() {
    const [plan, setPlan] = useState<PlanInfo | null>(null);
    const [flowCount, setFlowCount] = useState(0);
    const [connectionCount, setConnectionCount] = useState(0);
    const [notifyOnFailure, setNotifyOnFailure] = useState(true);
    const [notifyOnSuccess, setNotifyOnSuccess] = useState(false);
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            const [session, connections, flows] = await Promise.all([
                getSession(),
                getSabFlowConnections(),
                getSabFlows(),
            ]);
            setConnectionCount(connections?.length ?? 0);
            setFlowCount(flows?.length ?? 0);
            const userPlan = (session?.user as any)?.plan;
            if (userPlan) {
                setPlan({
                    name: userPlan.name,
                    flowLimit: userPlan.flowLimit ?? 0,
                    features: userPlan.features,
                });
            } else {
                setPlan({ name: 'Free', flowLimit: 3, features: {} });
            }
        });
    }, []);

    return (
        <div className="max-w-5xl mx-auto space-y-6" style={{ padding: 30 }}>
            <Button variant="ghost" size="sm" asChild className="-ml-3">
                <Link href="/dashboard/sabflow/flow-builder">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Flows
                </Link>
            </Button>

            <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500/15 to-emerald-500/15 border border-border/40 flex items-center justify-center shadow-sm">
                    <Settings className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">SabFlow Settings</h1>
                    <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                        Manage global SabFlow preferences, plan limits, notifications and access control.
                    </p>
                </div>
            </div>

            {/* Plan & usage */}
            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        Plan & Access
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Your current plan governs how many flows you can create and which features are available.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-6">
                            <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-lg border border-border/60 bg-muted/20">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold tracking-tight">{plan?.name || 'Free'}</span>
                                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 border-emerald-500/40 bg-emerald-500/5 dark:text-emerald-400">
                                            Active
                                        </Badge>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        Plan permissions are enforced automatically on every flow run.
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" asChild>
                                    <Link href="/dashboard/billing">Manage Plan</Link>
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <div className="rounded-lg border border-border/60 bg-card/50 p-3">
                                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
                                        <Workflow className="h-3 w-3" /> Flows
                                    </div>
                                    <p className="text-xl font-bold mt-1">
                                        {flowCount}<span className="text-xs text-muted-foreground font-normal"> / {plan?.flowLimit || '∞'}</span>
                                    </p>
                                </div>
                                <div className="rounded-lg border border-border/60 bg-card/50 p-3">
                                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
                                        <Cable className="h-3 w-3" /> Connections
                                    </div>
                                    <p className="text-xl font-bold mt-1">{connectionCount}</p>
                                </div>
                                <div className="rounded-lg border border-border/60 bg-card/50 p-3">
                                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
                                        <CheckCircle2 className="h-3 w-3" /> Status
                                    </div>
                                    <p className="text-base font-bold mt-1 text-emerald-600 dark:text-emerald-400">Healthy</p>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Connections & Logs shortcuts */}
            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle className="text-base">Quick Links</CardTitle>
                    <CardDescription className="text-xs">Jump to the most common SabFlow management surfaces.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Link href="/dashboard/sabflow/connections" className="group rounded-lg border border-border/60 bg-card/50 p-4 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-violet-500/10 border border-border/40 flex items-center justify-center">
                            <KeyRound className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold">API Keys & Connections</h3>
                            <p className="text-[11px] text-muted-foreground">Manage credentials for all connected apps.</p>
                        </div>
                    </Link>
                    <Link href="/dashboard/sabflow/logs" className="group rounded-lg border border-border/60 bg-card/50 p-4 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-500/10 border border-border/40 flex items-center justify-center">
                            <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold">Execution Logs</h3>
                            <p className="text-[11px] text-muted-foreground">View detailed run history, errors and timing.</p>
                        </div>
                    </Link>
                </CardContent>
            </Card>

            {/* Notifications */}
            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        Notifications
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Get notified about flow runs. Preferences are stored locally for now and will sync to your account in a future release.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
                            <div>
                                <p className="text-sm font-medium">Email on failure</p>
                                <p className="text-[11px] text-muted-foreground">Send me an email whenever a flow run fails.</p>
                            </div>
                            <Switch checked={notifyOnFailure} onCheckedChange={setNotifyOnFailure} />
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
                            <div>
                                <p className="text-sm font-medium">Email on success</p>
                                <p className="text-[11px] text-muted-foreground">Send me an email whenever a flow run completes successfully.</p>
                            </div>
                            <Switch checked={notifyOnSuccess} onCheckedChange={setNotifyOnSuccess} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Schedule runner info */}
            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        Scheduled Flows
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Flows with a schedule trigger are executed by a cron worker that runs every minute.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="rounded-lg bg-muted/40 border border-border/60 p-3 font-mono text-xs">
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Cron endpoint</div>
                        <code className="break-all">POST /api/sabflow/cron/run-scheduled</code>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                        Register this endpoint with Vercel Cron (or any external scheduler) to run every minute (<code className="bg-muted px-1 rounded">* * * * *</code>).
                        Set <code className="bg-muted px-1 rounded">CRON_SECRET</code> in your environment to lock the endpoint.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
