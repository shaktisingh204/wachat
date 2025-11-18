
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
import { Separator } from '@/components/ui/separator';

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
                        <CardTitle>API Request Action Guide</CardTitle>
                        <CardDescription>Make HTTP requests to any external API or webhook to fetch or send data.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <p>This action is one of the most powerful in SabFlow. It allows you to connect to virtually any service with a REST API. You can fetch data to use in later steps or send data to other systems.</p>
                        
                        <Separator />

                        <div>
                            <h4 className="font-semibold text-lg mb-2">Configuration Breakdown</h4>
                            <p className="text-sm text-muted-foreground mb-4">The API action is configured using several tabs:</p>
                             <Accordion type="multiple" defaultValue={['url', 'auth', 'body', 'response']} className="w-full">
                                <AccordionItem value="url">
                                    <AccordionTrigger>URL & Method</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        <p>Select the HTTP method (GET, POST, etc.) and enter the full URL of the API endpoint. You can use variables from previous steps in the URL.</p>
                                        <CodeBlock language="text" code={'https://api.example.com/users/{{trigger.userId}}'}/>
                                    </AccordionContent>
                                </AccordionItem>
                                 <AccordionItem value="auth">
                                    <AccordionTrigger>Authentication</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        <p>Secure your requests using one of the supported authentication methods.</p>
                                        <ul className="list-disc pl-5 space-y-2 text-sm">
                                            <li><strong>Bearer Token:</strong> Sends an `Authorization: Bearer YOUR_TOKEN` header.</li>
                                            <li><strong>API Key:</strong> Sends a key-value pair in either the headers or as a URL query parameter.</li>
                                            <li><strong>Basic Auth:</strong> Sends a base64-encoded `username:password` string in the `Authorization` header.</li>
                                        </ul>
                                    </AccordionContent>
                                </AccordionItem>
                                 <AccordionItem value="body">
                                    <AccordionTrigger>Request Body</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        <p>For POST or PUT requests, you can define the payload.</p>
                                         <ul className="list-disc pl-5 space-y-2 text-sm">
                                            <li><strong>Form Data:</strong> Sends data as `multipart/form-data`, useful for file uploads or simple key-value submissions.</li>
                                            <li><strong>JSON:</strong> Sends a raw JSON payload. You can use variables to construct the JSON dynamically.</li>
                                        </ul>
                                         <CodeBlock language="json" code={'{\n  "name": "{{trigger.userName}}",\n  "status": "active"\n}'}/>
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="response">
                                    <AccordionTrigger>Response Mapping</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        <p>After the API call succeeds, you can save parts of the JSON response into variables for use in subsequent steps. Use dot notation for nested data and square brackets for array elements.</p>
                                        <CodeBlock language="json" code={
`// Example API Response:
{
  "user": {
    "id": 123,
    "email": "test@example.com",
    "roles": ["admin", "editor"]
  },
  "posts": [
    { "id": "post1", "title": "First Post" }
  ]
}

// To save data from this response:
// 1. Save email:         Variable: user_email,   Response Path: user.email
// 2. Save first role:    Variable: first_role,   Response Path: user.roles[0]
// 3. Save first post ID: Variable: first_post,   Response Path: posts[0].id

// Then use them in another step like so:
// "User {{user_email}} (role: {{first_role}}) wrote post {{first_post}}."
`} />
                                         <p className="text-sm text-muted-foreground pt-2">You can also save the entire response object (status, headers, and data) to a single variable using the "Save Full Response To" field for advanced debugging or conditional logic.</p>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
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
