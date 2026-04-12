
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, Zap, Variable, Wand2 } from 'lucide-react';
import { sabnodeAppActions } from '@/lib/sabflow/apps';
import { cn } from '@/lib/utils';

export default function SabFlowDocsPage() {

    const groupedApps = sabnodeAppActions.reduce((acc, app) => {
        const category = app.category || 'SabNode Apps';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(app);
        return acc;
    }, {} as Record<string, typeof sabnodeAppActions>);

    const conceptBlocks = [
        {
            Icon: Zap,
            title: 'Triggers',
            description: 'Every flow starts with a trigger — a webhook, schedule, manual run, or an app event like a new WhatsApp message.',
            accent: 'emerald',
        },
        {
            Icon: Wand2,
            title: 'Actions',
            description: 'Actions are the building blocks. Each one performs a task — send a message, create a CRM deal, call an external API, and more.',
            accent: 'violet',
        },
        {
            Icon: Variable,
            title: 'Variables',
            description: 'Pass data between steps using double-curly syntax — {{trigger.data.name}} or {{Create_CRM_Lead.output.dealId}}.',
            accent: 'amber',
        },
    ] as const;

    const accentMap = {
        emerald: { bg: 'bg-emerald-500/10 dark:bg-emerald-400/10', text: 'text-emerald-600 dark:text-emerald-400', bar: 'from-emerald-500/40 to-transparent' },
        violet: { bg: 'bg-violet-500/10 dark:bg-violet-400/10', text: 'text-violet-600 dark:text-violet-400', bar: 'from-violet-500/40 to-transparent' },
        amber: { bg: 'bg-amber-500/10 dark:bg-amber-400/10', text: 'text-amber-600 dark:text-amber-400', bar: 'from-amber-500/40 to-transparent' },
    };

    return (
        <div className="flex flex-col gap-8 max-w-6xl mx-auto">
            {/* Hero */}
            <div>
                <Button variant="ghost" size="sm" asChild className="mb-3 -ml-3">
                    <Link href="/dashboard/sabflow/flow-builder">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Flows
                    </Link>
                </Button>
                <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-violet-500/10 via-emerald-500/5 to-amber-500/10 p-6 md:p-8">
                    <div className="relative z-10 flex items-start gap-4">
                        <div className="h-14 w-14 shrink-0 rounded-2xl bg-background/80 backdrop-blur-sm border border-border/60 flex items-center justify-center shadow-sm">
                            <BookOpen className="h-7 w-7 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold font-headline tracking-tight">SabFlow Documentation</h1>
                            <p className="text-muted-foreground mt-2 max-w-2xl text-sm md:text-base">
                                A guide to building powerful, cross-platform automations with SabFlow — connect apps, branch logic, and pass data between steps.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Concepts */}
            <div>
                <h2 className="text-lg font-semibold mb-3">Core Concepts</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {conceptBlocks.map(({ Icon, title, description, accent }) => {
                        const a = accentMap[accent];
                        return (
                            <Card key={title} className="relative overflow-hidden border-border/60">
                                <div className={cn("absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r", a.bar)} />
                                <CardContent className="p-5">
                                    <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center border border-border/40 mb-3", a.bg)}>
                                        <Icon className={cn("h-5 w-5", a.text)} />
                                    </div>
                                    <h3 className="text-sm font-semibold">{title}</h3>
                                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{description}</p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Variable example */}
            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle className="text-base">Passing Data with Variables</CardTitle>
                    <CardDescription>
                        The initial data comes from the trigger. For a webhook, this is the JSON body you send. The output of each action is added to the shared context.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-3">
                    <p className="text-muted-foreground">
                        Use double-curly syntax to reference values from previous steps:
                    </p>
                    <div className="rounded-lg bg-muted/50 border border-border/60 p-3 font-mono text-xs space-y-1.5">
                        <div><code className="text-emerald-600 dark:text-emerald-400">{'{{trigger.data.name}}'}</code> <span className="text-muted-foreground">— a field from the webhook payload</span></div>
                        <div><code className="text-violet-600 dark:text-violet-400">{'{{Create_CRM_Lead.output.dealId}}'}</code> <span className="text-muted-foreground">— the ID returned by a previous action</span></div>
                    </div>
                </CardContent>
            </Card>

            {/* App reference */}
            <div>
                <h2 className="text-xl font-bold font-headline">App & Action Reference</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                    Select an app to view its detailed documentation and available actions.
                </p>
            </div>

            <div className="space-y-6">
                {Object.entries(groupedApps).map(([category, apps]) => (
                    <div key={category}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{category}</h3>
                            <div className="flex-1 h-px bg-border/60" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {apps.map(app => {
                                const AppIcon = app.icon;
                                return (
                                    <Link key={app.appId} href={`/dashboard/sabflow/docs/${app.appId}`} passHref>
                                        <Card className="group h-full border-border/60 hover:border-violet-500/40 hover:-translate-y-0.5 hover:shadow-md transition-all">
                                            <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
                                                <div className="h-11 w-11 rounded-xl bg-muted/40 border border-border/40 flex items-center justify-center group-hover:scale-105 transition-transform">
                                                    <AppIcon className={cn("h-5 w-5", app.iconColor)} />
                                                </div>
                                                <p className="font-semibold text-xs leading-tight">{app.name}</p>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
