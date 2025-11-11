

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeBlock } from '@/components/wabasimplify/code-block';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const crmApiDocs = [
    {
        endpoint: 'GET /v1/crm/leads',
        description: 'Retrieves a paginated list of all leads for the user.',
        queryParams: [
            { name: 'page', type: 'number', desc: 'The page number to retrieve. Default: 1' },
            { name: 'limit', type: 'number', desc: 'The number of leads per page. Default: 20' },
            { name: 'query', type: 'string', desc: 'A search term to filter leads by title, name, email, or company.' },
        ],
        example: `curl -X GET \\
  "https://yourapp.com/api/v1/crm/leads?limit=5&query=Tech" \\
  -H 'Authorization: Bearer YOUR_API_KEY'`,
        response: `{
  "success": true,
  "data": [
    {
      "_id": "66a0d8...",
      "title": "New Website for TechCorp",
      "contactName": "John Doe",
      "email": "john@techcorp.com",
      // ...other lead fields
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 1,
    "totalPages": 1
  }
}`
    },
    {
        endpoint: 'POST /v1/crm/leads',
        description: 'Creates a new lead.',
        bodyParams: [
            { name: 'title', type: 'string', desc: 'The title or subject of the lead. (Required)' },
            { name: 'contactName', type: 'string', desc: 'Name of the primary contact. (Required)' },
            { name: 'email', type: 'string', desc: 'Email of the primary contact.' },
            { name: 'phone', type: 'string', desc: 'Phone number of the contact. (Optional)' },
            { name: 'company', type: 'string', desc: 'Company name associated with the lead. (Optional)' },
            { name: 'value', type: 'number', desc: 'The estimated monetary value of the deal. (Optional)' },
            { name: 'stage', type: 'string', desc: 'The current stage in your sales pipeline. (Optional)' },
            { name: 'source', type: 'string', desc: 'Where the lead came from (e.g., "Website", "Referral"). (Optional)' },
        ],
        example: `curl -X POST \\
  https://yourapp.com/api/v1/crm/leads \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "title": "API Generated Lead",
    "contactName": "Jane API",
    "email": "jane@api.com",
    "value": 7500,
    "source": "External API"
  }'`,
        response: `{
  "success": true,
  "data": {
    "_id": "66a0d9...",
    "title": "API Generated Lead",
    // ...full lead object
  }
}`
    },
    {
        endpoint: 'GET /v1/crm/leads/{leadId}',
        description: 'Retrieves a single lead by its unique ID.',
        example: `curl -X GET \\
  https://yourapp.com/api/v1/crm/leads/YOUR_LEAD_ID \\
  -H 'Authorization: Bearer YOUR_API_KEY'`,
        response: `{
  "success": true,
  "data": {
    "_id": "66a0d8...",
    "title": "New Website for TechCorp",
    // ...full lead object
  }
}`
    },
    {
        endpoint: 'PUT /v1/crm/leads/{leadId}',
        description: 'Updates an existing lead. You only need to provide the fields you want to change.',
        bodyParams: [
            { name: 'title', type: 'string', desc: 'The updated title of the lead.' },
            { name: 'stage', type: 'string', desc: 'The new stage in your sales pipeline.' },
            { name: 'value', type: 'number', desc: 'The updated monetary value.' },
        ],
        example: `curl -X PUT \\
  https://yourapp.com/api/v1/crm/leads/YOUR_LEAD_ID \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "stage": "Proposal Sent",
    "value": 8000
  }'`,
        response: `{
  "success": true,
  "data": {
    "_id": "66a0d8...",
    "stage": "Proposal Sent",
    "value": 8000,
    // ...other fields
  }
}`
    },
    {
        endpoint: 'DELETE /v1/crm/leads/{leadId}',
        description: 'Permanently deletes a lead.',
        example: `curl -X DELETE \\
  https://yourapp.com/api/v1/crm/leads/YOUR_LEAD_ID \\
  -H 'Authorization: Bearer YOUR_API_KEY'`,
        response: `{
  "success": true,
  "message": "Lead deleted successfully."
}`
    }
];


export default function ApiDocsPage() {
    return (
        <div className="max-w-4xl mx-auto space-y-8">
             <div>
                <Button variant="ghost" asChild className="mb-4 -ml-4">
                    <Link href="/dashboard/api">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to API Keys
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <BookOpen className="h-8 w-8" />
                    API Documentation
                </h1>
                <p className="text-muted-foreground mt-2">
                    Integrate your applications with SabNode using our REST API.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Authentication</CardTitle>
                    <CardDescription>
                        Authenticate your API requests by including your API key in the `Authorization` header.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CodeBlock code={'Authorization: Bearer YOUR_API_KEY'} language="bash" />
                    <p className="text-sm text-muted-foreground mt-2">You can generate API keys from the <Link href="/dashboard/api" className="text-primary hover:underline">API settings page</Link>.</p>
                </CardContent>
            </Card>

            <div className="space-y-4">
                 <h2 className="text-2xl font-bold font-headline">CRM Suite APIs</h2>
                 <div className="space-y-6">
                    {crmApiDocs.map((endpoint, i) => {
                        const [method, path] = endpoint.endpoint.split(' ');
                        return (
                            <Card key={i} className="card-gradient card-gradient-green">
                                <CardHeader>
                                    <div className="flex items-center gap-4">
                                        <Badge className={method === 'GET' ? 'bg-blue-600' : (method === 'POST' ? 'bg-green-600' : (method === 'PUT' ? 'bg-yellow-500' : 'bg-red-600'))}>{method}</Badge>
                                        <CardTitle className="font-mono text-lg">{path}</CardTitle>
                                    </div>
                                    <CardDescription>{endpoint.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {endpoint.queryParams && endpoint.queryParams.length > 0 && (
                                        <>
                                            <h4 className="font-semibold">Query Parameters</h4>
                                            <div className="border rounded-md overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Parameter</TableHead>
                                                            <TableHead>Type</TableHead>
                                                            <TableHead>Description</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {endpoint.queryParams.map(param => (
                                                            <TableRow key={param.name}>
                                                                <TableCell className="font-mono">{param.name}</TableCell>
                                                                <TableCell className="font-mono text-xs">{param.type}</TableCell>
                                                                <TableCell className="text-muted-foreground text-xs">{param.desc}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </>
                                    )}
                                    {endpoint.bodyParams && endpoint.bodyParams.length > 0 && (
                                        <>
                                            <h4 className="font-semibold">Request Body Parameters</h4>
                                            <div className="border rounded-md overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Parameter</TableHead>
                                                            <TableHead>Type</TableHead>
                                                            <TableHead>Description</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {endpoint.bodyParams.map(param => (
                                                            <TableRow key={param.name}>
                                                                <TableCell className="font-mono">{param.name}</TableCell>
                                                                <TableCell className="font-mono text-xs">{param.type}</TableCell>
                                                                <TableCell className="text-muted-foreground text-xs">{param.desc}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </>
                                    )}
                                    <div>
                                        <h4 className="font-semibold mb-2">Example Request</h4>
                                        <CodeBlock code={endpoint.example} language="bash" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-2">Example Response</h4>
                                        <CodeBlock code={endpoint.response} language="json" />
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                 </div>
            </div>
        </div>
    );
}
