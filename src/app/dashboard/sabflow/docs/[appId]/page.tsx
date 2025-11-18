
'use client';

import { useParams, notFound } from 'next/navigation';
import { sabnodeAppActions } from '@/lib/sabflow/apps';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/wabasimplify/code-block';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function AppDocPage() {
    const params = useParams();
    const appId = params.appId as string;

    const app = sabnodeAppActions.find(a => a.appId === appId);

    if (!app) {
        notFound();
    }

    const AppIcon = app.icon;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard/sabflow/docs">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to All Apps
                    </Link>
                </Button>
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-muted rounded-lg">
                        <AppIcon className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold font-headline">{app.name}</h1>
                        {app.description && <p className="text-muted-foreground mt-1">{app.description}</p>}
                    </div>
                </div>
            </div>

            {appId === 'api' ? (
                <Card>
                    <CardHeader>
                        <CardTitle>API Request Action</CardTitle>
                        <CardDescription>Make HTTP requests to any external API or webhook.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <p>This action is one of the most powerful in SabFlow. It allows you to connect to virtually any service that has a REST API. You can fetch data to use in later steps or send data to other systems.</p>
                        
                        <div>
                            <h4 className="font-semibold text-lg">Configuration Tabs</h4>
                            <p className="text-sm text-muted-foreground mb-2">The API action is configured using several tabs:</p>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                <li><strong>Params:</strong> URL query parameters to add to the request URL.</li>
                                <li><strong>Auth:</strong> Authentication method (Bearer Token, API Key, Basic Auth).</li>
                                <li><strong>Headers:</strong> Custom HTTP headers for the request.</li>
                                <li><strong>Body:</strong> The request payload, either as Form Data or a JSON object.</li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold text-lg">Response Mapping</h4>
                            <p className="text-sm text-muted-foreground mb-2">After the API call is successful, you can save parts of the JSON response into variables to use in subsequent steps. Use dot notation to specify the path to the data you want.</p>
                             <CodeBlock language="json" code={
`// Example API Response:
{
  "user": {
    "id": 123,
    "email": "test@example.com",
    "details": {
      "subscription_plan": "Pro"
    }
  }
}

// To save the email and plan, you would create two mappings:
// 1. Variable Name: user_email,   Response Path: user.email
// 2. Variable Name: subscription, Response Path: user.details.subscription_plan

// You can then use them in another step like so:
// "User {{user_email}} is on the {{subscription}} plan."
`} />
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Available Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {app.actions && app.actions.length > 0 ? (
                             <Accordion type="single" collapsible className="w-full">
                                {app.actions.map((action, index) => (
                                     <AccordionItem value={`item-${index}`} key={index}>
                                        <AccordionTrigger>{action.label}</AccordionTrigger>
                                        <AccordionContent className="space-y-4 pt-2">
                                            <p className="text-muted-foreground">{action.description}</p>
                                            {action.inputs.length > 0 && (
                                                <div>
                                                    <h5 className="font-semibold mb-2">Inputs:</h5>
                                                     <div className="border rounded-md">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>Field</TableHead>
                                                                    <TableHead>Type</TableHead>
                                                                    <TableHead>Description</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {action.inputs.map((input: any, i: number) => (
                                                                    <TableRow key={i}>
                                                                        <TableCell className="font-mono text-xs">{input.name}</TableCell>
                                                                         <TableCell><Badge variant="outline">{input.type}</Badge></TableCell>
                                                                         <TableCell>{input.placeholder}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>
                                            )}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        ) : (
                            <p className="text-muted-foreground text-center py-8">No specific actions are defined for this app in the documentation yet.</p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// Generate static paths for all apps
export async function generateStaticParams() {
  return sabnodeAppActions.map(app => ({
    appId: app.appId,
  }));
}
