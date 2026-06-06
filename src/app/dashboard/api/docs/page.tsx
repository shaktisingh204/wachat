import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Badge,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { CodeBlock } from '@/components/zoruui-domain/code-block';
import { ArrowLeft, BookOpen } from 'lucide-react';

import Link from 'next/link';

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
            { name: 'source', type: 'string', desc: 'Where the lead came from (e.g. "Website", "Referral"). (Optional)' },
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

const METHOD_TONE: Record<string, BadgeTone> = {
    GET: 'info',
    POST: 'success',
    PUT: 'warning',
    DELETE: 'danger',
};

export default function ApiDocsPage() {
    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <Link
                    href="/dashboard/api"
                    className="inline-flex items-center gap-2 text-sm text-[var(--st-text-secondary)] transition-colors hover:text-[var(--st-text)]"
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to API Keys
                </Link>
                <PageHeader bordered={false}>
                    <PageHeaderHeading>
                        <PageTitle className="flex items-center gap-3">
                            <BookOpen className="h-7 w-7" aria-hidden="true" />
                            API Documentation
                        </PageTitle>
                        <PageDescription>
                            Integrate your applications with SabNode using our REST API.
                        </PageDescription>
                    </PageHeaderHeading>
                </PageHeader>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Authentication</CardTitle>
                    <CardDescription>
                        Authenticate your API requests by including your API key in the Authorization header.
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <CodeBlock code={'Authorization: Bearer YOUR_API_KEY'} language="bash" />
                    <p className="mt-2 text-sm text-[var(--st-text-secondary)]">
                        You can generate API keys from the{' '}
                        <Link href="/dashboard/api" className="text-[var(--st-text)] hover:underline">
                            API settings page
                        </Link>
                        .
                    </p>
                </CardBody>
            </Card>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-[var(--st-text)]">CRM Suite APIs</h2>
                <div className="space-y-6">
                    {crmApiDocs.map((endpoint, i) => {
                        const [method, path] = endpoint.endpoint.split(' ');
                        return (
                            <Card key={i}>
                                <CardHeader>
                                    <div className="flex items-center gap-4">
                                        <Badge tone={METHOD_TONE[method] ?? 'neutral'} kind="solid">{method}</Badge>
                                        <CardTitle className="font-mono text-lg">{path}</CardTitle>
                                    </div>
                                    <CardDescription>{endpoint.description}</CardDescription>
                                </CardHeader>
                                <CardBody className="space-y-6">
                                    {endpoint.queryParams && endpoint.queryParams.length > 0 && (
                                        <div className="space-y-3">
                                            <h3 className="font-semibold text-[var(--st-text)]">Query Parameters</h3>
                                            <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
                                                <Table>
                                                    <THead>
                                                        <Tr>
                                                            <Th>Parameter</Th>
                                                            <Th>Type</Th>
                                                            <Th>Description</Th>
                                                        </Tr>
                                                    </THead>
                                                    <TBody>
                                                        {endpoint.queryParams.map(param => (
                                                            <Tr key={param.name}>
                                                                <Td className="font-mono">{param.name}</Td>
                                                                <Td className="font-mono text-xs">{param.type}</Td>
                                                                <Td className="text-xs text-[var(--st-text-secondary)]">{param.desc}</Td>
                                                            </Tr>
                                                        ))}
                                                    </TBody>
                                                </Table>
                                            </div>
                                        </div>
                                    )}
                                    {endpoint.bodyParams && endpoint.bodyParams.length > 0 && (
                                        <div className="space-y-3">
                                            <h3 className="font-semibold text-[var(--st-text)]">Request Body Parameters</h3>
                                            <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
                                                <Table>
                                                    <THead>
                                                        <Tr>
                                                            <Th>Parameter</Th>
                                                            <Th>Type</Th>
                                                            <Th>Description</Th>
                                                        </Tr>
                                                    </THead>
                                                    <TBody>
                                                        {endpoint.bodyParams.map(param => (
                                                            <Tr key={param.name}>
                                                                <Td className="font-mono">{param.name}</Td>
                                                                <Td className="font-mono text-xs">{param.type}</Td>
                                                                <Td className="text-xs text-[var(--st-text-secondary)]">{param.desc}</Td>
                                                            </Tr>
                                                        ))}
                                                    </TBody>
                                                </Table>
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="mb-2 font-semibold text-[var(--st-text)]">Example Request</h3>
                                        <CodeBlock code={endpoint.example} language="bash" />
                                    </div>
                                    <div>
                                        <h3 className="mb-2 font-semibold text-[var(--st-text)]">Example Response</h3>
                                        <CodeBlock code={endpoint.response} language="json" />
                                    </div>
                                </CardBody>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
