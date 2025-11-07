
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft, GitFork } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { sabnodeAppActions } from '@/lib/sabflow-actions';

export default function SabFlowDocsPage() {
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
                        To use a variable from a previous step, use the double curly brace syntax: <Badge variant="outline" className="font-mono">{"{{trigger.data.name}}"}</Badge> to get a 'name' field from the webhook payload, or <Badge variant="outline" className="font-mono">{"{{Create_CRM_Lead.output.dealId}}"}</Badge> to get the ID from a previous CRM action.
                    </p>
                </CardContent>
            </Card>

            <Separator />

            <div>
                <h2 className="text-2xl font-bold font-headline">Available Actions</h2>
                <p className="text-muted-foreground mt-1">
                    An overview of all available triggers and actions.
                </p>
            </div>

            <Accordion type="multiple" className="w-full">
                {sabnodeAppActions.map((app) => (
                     <AccordionItem value={app.appId} key={app.appId}>
                        <AccordionTrigger className="text-lg font-semibold">{app.name}</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             {app.actions.map((action, index) => (
                                 <div key={index} className="p-3 border rounded-md">
                                     <h4 className="font-semibold text-base">{action.label}</h4>
                                     <p className="text-sm text-muted-foreground">{action.description}</p>
                                     {action.inputs.length > 0 && (
                                         <div className="mt-2">
                                             <h5 className="font-medium text-xs uppercase text-muted-foreground">Inputs:</h5>
                                             <ul className="list-disc list-inside space-y-1 text-sm mt-1">
                                                 {action.inputs.map((input, i) => (
                                                     <li key={i}><strong>{input.label}:</strong> ({input.type})</li>
                                                 ))}
                                             </ul>
                                         </div>
                                     )}
                                 </div>
                             ))}
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
}

    