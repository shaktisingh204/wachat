
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft, GitFork } from 'lucide-react';
import { sabnodeAppActions } from '@/lib/sabflow/apps';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function SabFlowDocsPage() {

    const groupedApps = sabnodeAppActions.reduce((acc, app) => {
        const category = app.category || 'SabNode Apps';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(app);
        return acc;
    }, {} as Record<string, typeof sabnodeAppActions>);


    return (
        <div className="flex flex-col gap-8">
            <div>
                <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard/sabflow/flow-builder">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to Flows
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">SabFlow Documentation</h1>
                <p className="text-muted-foreground mt-2 max-w-3xl">
                    A guide to building powerful, cross-platform automations with SabFlow.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>How SabFlow Works</CardTitle>
                    <CardDescription>
                        SabFlow executes a series of actions sequentially. The output of one action can be used as the input for subsequent actions.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-4">
                    <h4 className="font-semibold">Triggers</h4>
                    <p>
                        Every flow starts with a trigger. Currently, you can trigger a flow manually or by calling a unique Webhook URL. More app-based triggers (e.g., "New WhatsApp Message") are coming soon.
                    </p>
                    <h4 className="font-semibold">Actions</h4>
                    <p>
                        Actions are the building blocks of your flow. Each action performs a specific task in one of the SabNode apps (like sending a WhatsApp message or creating a CRM deal).
                    </p>
                    <h4 className="font-semibold">Context & Variables</h4>
                    <p>
                        Variables allow you to pass data between steps. The initial data comes from the trigger. For a webhook trigger, this is the JSON body you send. The output of each action is then added to the context.
                    </p>
                    <p>
                        To use a variable from a previous step, use the double curly brace syntax: <code className="bg-muted px-1 rounded-sm">{'{{trigger.data.name}}'}</code> to get a 'name' field from the webhook payload, or <code className="bg-muted px-1 rounded-sm">{'{{Create_CRM_Lead.output.dealId}}'}</code> to get the ID from a previous CRM action.
                    </p>
                </CardContent>
            </Card>
            
            <div>
                <h2 className="text-2xl font-bold font-headline">App & Action Reference</h2>
                <p className="text-muted-foreground mt-1">
                    Select an app to view its detailed documentation and available actions.
                </p>
            </div>

            <div className="space-y-4">
                {Object.entries(groupedApps).map(([category, apps]) => (
                    <div key={category}>
                        <h3 className="text-xl font-semibold mb-2">{category}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {apps.map(app => {
                                const AppIcon = app.icon;
                                return (
                                <Link key={app.appId} href={`/dashboard/sabflow/docs/${app.appId}`} passHref>
                                    <Card className="h-full hover:border-primary hover:shadow-lg transition-all">
                                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                            <AppIcon className={cn("h-8 w-8 mb-2", app.iconColor)} />
                                            <p className="font-semibold text-sm">{app.name}</p>
                                        </CardContent>
                                    </Card>
                                </Link>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
