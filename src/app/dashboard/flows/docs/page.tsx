
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, Info, Server } from 'lucide-react';
import type { Metadata } from 'next';
import { CodeBlock } from '@/components/wabasimplify/code-block';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const ApiSection = ({ title, description, requestType, endpoint, parameters, sampleRequest, sampleResponse, children }: { title: string, description: string, requestType: string, endpoint: string, parameters?: { name: string, type: string, optional?: boolean, desc: React.ReactNode }[], sampleRequest: string, sampleResponse: string, children?: React.ReactNode }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-2 font-mono text-sm">
                    <Badge variant={requestType === 'POST' ? 'default' : requestType === 'GET' ? 'secondary' : 'destructive'} className="w-16 justify-center">{requestType}</Badge>
                    <span className="text-muted-foreground">{endpoint}</span>
                </div>
                {parameters && (
                    <>
                    <h4 className="font-semibold pt-2">Parameters</h4>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Parameter</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Description</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {parameters.map(param => (
                                <TableRow key={param.name}>
                                    <TableCell className="font-mono">{param.name}{!param.optional && <span className="text-destructive">*</span>}</TableCell>
                                    <TableCell className="font-mono">{param.type}</TableCell>
                                    <TableCell>{param.desc}</TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    </>
                )}
                <h4 className="font-semibold pt-2">Sample Request</h4>
                <CodeBlock code={sampleRequest} language="bash" />
                
                {children}

                <h4 className="font-semibold pt-2">Sample Response</h4>
                <CodeBlock code={sampleResponse} language="json" />
            </CardContent>
        </Card>
    );
};


export default function FlowsApiDocsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button variant="ghost" asChild className="mb-4 -ml-4">
          <Link href="/dashboard/flows">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Meta Flows
          </Link>
        </Button>
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
            <Server className="h-8 w-8"/>
            Flows API Documentation
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
            A guide to the Meta Graph API endpoints for managing interactive WhatsApp Flows.
        </p>
      </div>
      
      <Card>
          <CardHeader>
            <CardTitle>API Variables</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">The following variables are used in the API call examples below.</p>
             <div className="border rounded-md mt-4">
                <Table>
                    <TableHeader><TableRow><TableHead>Variable</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
                    <TableBody>
                        <TableRow><TableCell className="font-mono">BASE-URL</TableCell><TableCell>Base URL for the Graph API, e.g., <code className="bg-muted px-1 py-0.5 rounded">https://graph.facebook.com/v18.0</code></TableCell></TableRow>
                        <TableRow><TableCell className="font-mono">ACCESS-TOKEN</TableCell><TableCell>A valid User or System User access token with required permissions.</TableCell></TableRow>
                        <TableRow><TableCell className="font-mono">WABA-ID</TableCell><TableCell>The ID of your WhatsApp Business Account.</TableCell></TableRow>
                        <TableRow><TableCell className="font-mono">FLOW-ID</TableCell><TableCell>The ID of a specific Flow, returned when you create one.</TableCell></TableRow>
                    </TableBody>
                </Table>
            </div>
          </CardContent>
      </Card>
      
      <Separator />

      <div className="space-y-6">
        <ApiSection
            title="Creating a Flow"
            description="New Flows are by default created in DRAFT status. You can create and publish a new Flow in a single request by specifying the flow_json and publish parameters."
            requestType="POST"
            endpoint="/{WABA-ID}/flows"
            parameters={[
                { name: 'name', type: 'string', desc: 'The name for your new Flow.' },
                { name: 'categories', type: 'array', desc: 'A list of categories for your Flow, e.g., ["LEAD_GENERATION"].' },
                { name: 'flow_json', type: 'string', optional: true, desc: 'The complete Flow JSON structure, encoded as a string.' },
                { name: 'publish', type: 'boolean', optional: true, desc: 'Set to true to publish the flow immediately upon creation.' },
                { name: 'clone_flow_id', type: 'string', optional: true, desc: 'The ID of an existing Flow to clone.' },
                { name: 'endpoint_uri', type: 'string', optional: true, desc: 'The endpoint URL for data exchange flows.' },
            ]}
            sampleRequest={`curl -X POST '{BASE-URL}/{WABA-ID}/flows' \\
--header 'Authorization: Bearer {ACCESS-TOKEN}' \\
--header "Content-Type: application/json" \\
--data '{
  "name": "My first flow",
  "categories": [ "OTHER" ],
  "flow_json" : "{\\"version\\":\\"5.0\\",\\"screens\\":[{\\"id\\":\\"WELCOME_SCREEN\\",\\"layout\\":{\\"type\\":\\"SingleColumnLayout\\",\\"children\\":[{\\"type\\":\\"TextHeading\\",\\"text\\":\\"Hello World\\"},{\\"type\\":\\"Footer\\",\\"label\\":\\"Complete\\",\\"on-click-action\\":{\\"name\\":\\"complete\\",\\"payload\\":{}}}]},\"title\\":\\"Welcome\\",\\"terminal\\":true,\\"success\\":true,\\"data\\":{}}]}",
  "publish" : true
}'`}
            sampleResponse={`{\n  "id": "<Flow-ID>",\n  "success": true,\n  "validation_errors": []\n}`}
        />

         <ApiSection
            title="Updating a Flow"
            description="After creating a Flow, you can update its metadata like name, categories, or endpoint URI."
            requestType="POST"
            endpoint="/{FLOW-ID}"
            parameters={[
                { name: 'name', type: 'string', optional: true, desc: 'A new name for your Flow.' },
                { name: 'categories', type: 'array', optional: true, desc: 'An updated list of categories.' },
                { name: 'endpoint_uri', type: 'string', optional: true, desc: 'Update the endpoint URL for data exchange flows.' },
            ]}
            sampleRequest={`curl -X POST '{BASE-URL}/{FLOW-ID}' \\
--header 'Authorization: Bearer {ACCESS-TOKEN}' \\
--header "Content-Type: application/json" \\
--data '{\n  "name": "New flow name"\n}'`}
            sampleResponse={`{\n  "success": true\n}`}
        />
        
        <ApiSection
            title="Retrieving a List of Flows"
            description="Fetch a paginated list of all Flows associated with your WhatsApp Business Account."
            requestType="GET"
            endpoint="/{WABA-ID}/flows"
            sampleRequest={`curl '{BASE-URL}/{WABA-ID}/flows' \\
--header 'Authorization: Bearer {ACCESS-TOKEN}'`}
            sampleResponse={`{\n  "data": [\n    {\n        "id": "flow-1",\n        "name": "flow 1",\n        "status": "DRAFT",\n        "categories": [ "CONTACT_US" ],\n        "validation_errors": []\n    }\n  ],\n  "paging": {\n    "cursors": {\n      "before": "...",\n      "after": "..."\n    }\n  }\n}`}
        />
        
        <ApiSection
            title="Deleting a Flow"
            description="A Flow can only be deleted while it is in the DRAFT status. Published flows cannot be deleted."
            requestType="DELETE"
            endpoint="/{FLOW-ID}"
            sampleRequest={`curl -X DELETE '{BASE-URL}/{FLOW-ID}' \\
--header 'Authorization: Bearer {ACCESS-TOKEN}'`}
            sampleResponse={`{\n  "success": true\n}`}
        />

      </div>

    </div>
  );
}
